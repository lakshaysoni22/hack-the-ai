from flask import Blueprint, request, session, jsonify
import secrets
from extensions import limiter, db
from models import EvidenceProgress, LabProgress, Flag, ManualLabFlag, ManualLabProgress, User, Challenge, ChallengeProgress, Mission, MissionProgress, MissionQuiz, QuizAttempt
from services.progress_service import update_unlocks
from services.quiz_service import evaluate_quiz
from services.hint_service import get_hint
from services.audit_service import log_action
from services.docker_service import start_lab_container
from services.resume_service import extract_text_from_pdf, analyze_resume

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/quiz', methods=['POST'])
@api_bp.route('/quiz/evaluate', methods=['POST'])
@limiter.limit("60 per minute")
def submit_quiz():
    if 'user_id' not in session:
        return jsonify({'success': False, 'correct': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'correct': False, 'message': 'Invalid input'}), 400
        
    lab_id = data.get('lab_id')
    mission_id = data.get('mission_id')
    answer = data.get('answer', '')
    question_id = data.get('question_id')

    success, message, xp, extra_data = evaluate_quiz(user_id, lab_id, mission_id, answer, question_id=question_id)
    
    if success:
        log_action(user_id, 'QUIZ_SUCCESS', f"Mission: {mission_id} Quiz: {question_id or 'default'}")
        update_unlocks(user_id)
        db.session.commit()
        resp = {'success': True, 'correct': True, 'message': message, 'xp': xp}
        if extra_data:
            resp.update(extra_data)
        return jsonify(resp)
        
    log_action(user_id, 'QUIZ_FAILED', f"Mission: {mission_id} Quiz: {question_id or 'default'}")
    resp = {'success': False, 'correct': False, 'message': message}
    if extra_data:
        resp.update(extra_data)
    return jsonify(resp)

@api_bp.route('/hint', methods=['POST'])
@api_bp.route('/hint/unlock', methods=['POST'])
@limiter.limit("20 per minute")
def use_hint():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
        
    hint_id = data.get('hint_id')
    if hint_id:
        from models import Hint
        hint_obj = Hint.query.filter_by(id=hint_id).first()
        if hint_obj:
            log_action(user_id, 'HINT_USED', f"Hint ID: {hint_id}")
            return jsonify({'success': True, 'message': 'Hint unlocked.', 'hint_text': hint_obj.hint_text, 'hint': hint_obj.hint_text})
        return jsonify({'success': False, 'message': 'Hint not found.'})

    lab_id = data.get('lab_id')
    mission_id = data.get('mission_id')
    if not lab_id or not mission_id:
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
    
    success, message, hint_text = get_hint(user_id, lab_id, mission_id)
    if success:
        log_action(user_id, 'HINT_USED', f"Mission: {mission_id}")
        return jsonify({'success': True, 'message': message, 'hint': hint_text, 'hint_text': hint_text})
        
    return jsonify({'success': False, 'message': message})

@api_bp.route('/evidence', methods=['POST'])
@limiter.limit("30 per minute")
def collect_evidence():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json()
    if not data or not all(k in data for k in ("lab_id", "evidence_id")):
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
        
    lab_id = data.get('lab_id')
    evidence_id = data.get('evidence_id')
    
    # Verify evidence hasn't been collected yet
    existing = EvidenceProgress.query.filter_by(user_id=user_id, evidence_id=evidence_id).first()
    if existing:
        if not existing.collected:
            existing.collected = True
            db.session.add(existing)
            lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
            if lp:
                lp.score += 25
                db.session.add(lp)
            log_action(user_id, 'EVIDENCE_COLLECTED', f"Evidence: {evidence_id}")
            db.session.commit()
            return jsonify({'success': True, 'message': 'Evidence collected.'})
        return jsonify({'success': False, 'message': 'Evidence already collected.'})
        
    # Insert evidence_progress
    new_ev = EvidenceProgress(user_id=user_id, evidence_id=evidence_id, collected=True)
    db.session.add(new_ev)
    
    # Add points
    lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
    if lp:
        lp.score += 25
        db.session.add(lp)
        
    log_action(user_id, 'EVIDENCE_COLLECTED', f"Evidence: {evidence_id}")
    db.session.commit()
    return jsonify({'success': True, 'message': 'Evidence collected.'})

@api_bp.route('/flag', methods=['POST'])
@limiter.limit("10 per minute")
def submit_flag():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json()
    if not data or not all(k in data for k in ("lab_id", "flag")):
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
        
    lab_id = data.get('lab_id')
    flag_val = data.get('flag')
    
    correct_flag = Flag.query.filter_by(lab_id=lab_id).first()
    
    if correct_flag and correct_flag.flag_value == flag_val:
        lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
        if lp:
            lp.status = 'COMPLETED'
            db.session.add(lp)
            
        update_unlocks(user_id)
        log_action(user_id, 'FLAG_SUCCESS', f"Lab: {lab_id}")
        db.session.commit()
        return jsonify({'success': True, 'message': 'Flag accepted! Lab complete.'})
    
    log_action(user_id, 'FLAG_FAILED', f"Lab: {lab_id}")
    return jsonify({'success': False, 'message': 'Incorrect flag.'})

@api_bp.route('/lab/submit', methods=['POST'])
@limiter.limit("10 per minute")
def submit_lab():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json() or {}
    lab_id = data.get('lab_id', 'lab6')
    
    # Verify all missions are completed before allowing final submission
    lab_missions = Mission.query.filter_by(lab_id=lab_id).all()
    user_mps = MissionProgress.query.filter_by(user_id=user_id, lab_id=lab_id).all()
    completed_m_ids = {mp.mission_id for mp in user_mps if mp.status == 'COMPLETED'}
    
    if lab_missions and not all(m.id in completed_m_ids for m in lab_missions):
        return jsonify({
            'success': False,
            'message': 'Please complete all 5 investigation chapters and verify the Capstone Quiz before submitting the lab.'
        }), 400
        
    # Update LabProgress
    lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
    if not lp:
        lp = LabProgress(user_id=user_id, lab_id=lab_id, status='COMPLETED', score=500, percentage=100)
        db.session.add(lp)
    else:
        lp.status = 'COMPLETED'
        lp.score = max(lp.score or 0, 500)
        lp.percentage = 100
        db.session.add(lp)
        
    # Mark all missions for this lab as completed
    lab_missions = Mission.query.filter_by(lab_id=lab_id).all()
    for m in lab_missions:
        mp = MissionProgress.query.filter_by(user_id=user_id, mission_id=m.id).first()
        if mp:
            mp.status = 'COMPLETED'
            db.session.add(mp)
        else:
            mp = MissionProgress(user_id=user_id, lab_id=lab_id, mission_id=m.id, status='COMPLETED')
            db.session.add(mp)
            
    # Mark all evidence as collected
    from models import Evidence
    evidences = Evidence.query.filter_by(lab_id=lab_id).all()
    for ev in evidences:
        ep = EvidenceProgress.query.filter_by(user_id=user_id, evidence_id=ev.id).first()
        if ep:
            ep.collected = True
            db.session.add(ep)
        else:
            ep = EvidenceProgress(user_id=user_id, evidence_id=ev.id, collected=True)
            db.session.add(ep)
            
    update_unlocks(user_id)
    log_action(user_id, 'LAB_SUBMITTED', f"Lab: {lab_id}")
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Congratulations! Lab submitted successfully and threat contained!',
        'xp': 1500,
        'rank': 'CERTIFIED WEB3 & AI THREAT HUNTER',
        'score': 100,
        'chapters_completed': 5
    })

@api_bp.route('/lab6/post-investigation-result', methods=['POST'])
@limiter.limit("20 per minute")
def record_post_investigation_result():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json() or {}
    
    score = data.get('score', 0)
    total = data.get('total', 10)
    accuracy = data.get('accuracy', 0)
    rank = data.get('rank', 'CYBER INVESTIGATOR')
    time_taken = data.get('time_taken', '00:00')
    
    log_action(user_id, 'POST_INVESTIGATION_COMPLETED', f"Score: {score}/{total}, Accuracy: {accuracy}%, Rank: {rank}, Time: {time_taken}")
    
    lp = LabProgress.query.filter_by(user_id=user_id, lab_id='lab6').first()
    if lp:
        quiz_bonus = int(score) * 20
        lp.score = max(lp.score or 0, 100 + quiz_bonus)
        lp.percentage = max(lp.percentage or 0, int(accuracy))
        db.session.add(lp)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Post-investigation assessment recorded successfully.',
        'rank': rank,
        'score': score,
        'accuracy': accuracy
    })


@api_bp.route('/manual-lab/start', methods=['POST'])
@limiter.limit("5 per minute")
def start_manual_lab():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    data = request.get_json()
    if not data or 'lab_id' not in data:
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
        
    lab_id = data.get('lab_id')
    user_id = session['user_id']
    
    if lab_id != 'mlab2':
        # Fallback to mock for others
        return jsonify({'success': True, 'ip': f"10.10.{secrets.randbelow(255)}.{secrets.randbelow(255)}"})
        
    ip, msg = start_lab_container(lab_id, user_id)
    if ip:
        return jsonify({'success': True, 'ip': ip})
    return jsonify({'success': False, 'message': msg})

@api_bp.route('/manual-lab/flag', methods=['POST'])
@limiter.limit("10 per minute")
def submit_manual_lab_flag():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json()
    if not data or not all(k in data for k in ("lab_id", "flag")):
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
        
    lab_id = data.get('lab_id')
    flag_val = data.get('flag')
    
    correct_flag = ManualLabFlag.query.filter_by(manual_lab_id=lab_id).first()
    
    if correct_flag and correct_flag.flag_value == flag_val:
        mlp = ManualLabProgress.query.filter_by(user_id=user_id, manual_lab_id=lab_id).first()
        if mlp:
            mlp.status = 'COMPLETED'
            mlp.score = 100
        else:
            mlp = ManualLabProgress(user_id=user_id, manual_lab_id=lab_id, status='COMPLETED', score=100)
            
        db.session.add(mlp)
        log_action(user_id, 'MANUAL_LAB_FLAG_SUCCESS', f"Manual Lab: {lab_id}")
        db.session.commit()
        return jsonify({'success': True, 'message': 'Flag accepted! Manual Lab complete.'})
    
    log_action(user_id, 'MANUAL_LAB_FLAG_FAILED', f"Manual Lab: {lab_id}")
    return jsonify({'success': False, 'message': 'Incorrect flag.'})

@api_bp.route('/proctoring_alert', methods=['POST'])
@limiter.limit("20 per minute")
def proctoring_alert():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    data = request.get_json()
    if not data or 'action' not in data:
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
        
    action = data.get('action')
    log_action(user_id, 'PROCTORING_ALERT', f"Activity: {action}")
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Alert logged.'})

@api_bp.route('/resume/analyze', methods=['POST'])
@limiter.limit("5 per minute")
def resume_analyze():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
    if 'resume' not in request.files:
        return jsonify({'success': False, 'message': 'No file uploaded.'}), 400
        
    file = request.files['resume']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected.'}), 400
        
    if not file.filename.lower().endswith(('.pdf', '.doc', '.docx')):
        return jsonify({'success': False, 'message': 'Invalid file type. Only PDF/DOCX allowed.'}), 400
        
    try:
        # Extract text
        text = extract_text_from_pdf(file)
        if not text:
            return jsonify({'success': False, 'message': 'Could not extract text from the file.'}), 400
            
        # Get user stats to append to AI context
        user_id = session['user_id']
        user = User.query.get(user_id)
        stats = {
            "username": user.username,
            "role": user.role
        }
        
        # Analyze with AI
        result = analyze_resume(text, user_stats=stats)
        
        log_action(user_id, 'RESUME_ANALYZED', f"Eligible: {result.get('eligible', False)}")
        db.session.commit()
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in resume_analyze: {e}")
        return jsonify({'success': False, 'message': 'Server error during analysis.'}), 500


# =========================================================================
# Lab Engine API (ZIP-to-Interactive Lab System)
# =========================================================================

@api_bp.route('/lab-engine/start', methods=['POST'])
@limiter.limit("5 per minute")
def lab_engine_start():
    """Start a lab session: create session record and optionally launch Docker container."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    import uuid
    import json
    from datetime import datetime, timedelta
    from flask import current_app
    from models import (UploadedLab, LabSession, LabSessionProgress,
                        LabSessionMissionProgress)
    from services.docker_service import start_uploaded_lab_container, stop_uploaded_lab_container, is_target_alive
    from services.audit_service import log_action

    data = request.get_json()
    if not data or 'lab_id' not in data:
        return jsonify({'success': False, 'message': 'Missing lab_id'}), 400

    lab_id = data['lab_id']
    user_id = session['user_id']

    lab = UploadedLab.query.get(lab_id)
    if not lab or lab.status != 'published':
        return jsonify({'success': False, 'message': 'Lab not found or not published.'}), 404

    from routes.labs import is_lab_locked_for_user
    has_session = LabSession.query.filter_by(user_id=user_id, lab_id=lab_id).first() is not None
    if not has_session and is_lab_locked_for_user(user_id, lab):
        return jsonify({'success': False, 'message': 'Complete the earlier labs in the path first.'}), 403

    # Check for existing active session
    existing = LabSession.query.filter_by(
        user_id=user_id, lab_id=lab_id, status='ACTIVE'
    ).first()
    if existing and existing.container_port and is_target_alive(existing.container_port):
        return jsonify({
            'success': True,
            'message': 'Resuming existing session.',
            'session_id': existing.id,
            'container_port': existing.container_port,
            'target_url': f'http://127.0.0.1:{existing.container_port}',
        })

    timeout = current_app.config.get('LAB_SESSION_TIMEOUT', 3600)
    expiration = datetime.utcnow() + timedelta(seconds=timeout)

    if existing:
        # The session row says ACTIVE but nothing answers on its port
        # anymore - the process crashed, was reaped, or lost a port race
        # at some point after starting. Relaunch a fresh target under the
        # SAME session id (so progress/missions carry over) instead of
        # handing the learner back the same dead URL forever.
        if existing.container_id:
            try:
                stop_uploaded_lab_container(existing.id, existing.container_id)
            except Exception:
                pass
        lab_session = existing
        lab_session.status = 'STARTING'
        lab_session.container_port = None
        lab_session.container_id = None
        lab_session.expiration = expiration
        session_id = lab_session.id
        db.session.add(lab_session)
    else:
        # Create new session
        session_id = f"sess-{uuid.uuid4().hex[:12]}"

        lab_session = LabSession(
            id=session_id,
            user_id=user_id,
            lab_id=lab_id,
            status='STARTING',
            expiration=expiration,
        )
        db.session.add(lab_session)

        # Create progress record
        missions = lab.missions
        progress = LabSessionProgress(
            session_id=session_id,
            score=0,
            total_possible=lab.total_points,
            missions_completed=0,
            missions_total=len(missions),
        )
        db.session.add(progress)

        # Create mission progress records
        for i, mission in enumerate(missions):
            mp = LabSessionMissionProgress(
                session_id=session_id,
                mission_id=mission.id,
                status='AVAILABLE' if i == 0 else 'LOCKED',
            )
            db.session.add(mp)

    db.session.flush()

    # Try to launch Docker container
    container_port = None
    target_url = None
    docker_config = {}
    if lab.docker_config:
        try:
            docker_config = json.loads(lab.docker_config)
        except json.JSONDecodeError:
            pass

    if docker_config.get('has_dockerfile') or docker_config.get('has_compose'):
        lab_path = lab.zip_path
        if lab.target_app_path:
            # target_app_path is relative to the extract base
            # zip_path IS the extract base directory
            import os
            lab_path = os.path.join(lab.zip_path, lab.target_app_path)

        # Portability fallback: zip_path is an ABSOLUTE path baked into the
        # database at upload time on whatever machine that was. If this app
        # has since been moved/re-extracted elsewhere (e.g. a fresh clone on
        # a different computer), that stored path won't exist here even
        # though the lab files themselves were shipped alongside the DB.
        # Reconstruct the path under this install's actual LAB_UPLOAD_DIR
        # using the lab folder's basename, which is stable across machines.
        if not os.path.isdir(lab_path):
            upload_dir = current_app.config.get(
                'LAB_UPLOAD_DIR',
                os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'uploaded_labs'),
            )
            lab_folder_name = os.path.basename(os.path.normpath(lab.zip_path))
            candidate = os.path.join(upload_dir, lab_folder_name)
            if lab.target_app_path:
                candidate = os.path.join(candidate, lab.target_app_path)
            if os.path.isdir(candidate):
                lab_path = candidate

        port_min = current_app.config.get('LAB_CONTAINER_PORT_MIN', 10000)
        port_max = current_app.config.get('LAB_CONTAINER_PORT_MAX', 20000)

        host_port, container_id, msg = start_uploaded_lab_container(
            lab_id, session_id, lab_path, docker_config,
            port_min=port_min, port_max=port_max, timeout=timeout,
        )

        if not host_port:
            return jsonify({'success': False, 'message': msg}), 500

        lab_session.container_port = host_port
        lab_session.container_id = container_id
        container_port = host_port
        target_url = f'http://127.0.0.1:{host_port}'

    lab_session.status = 'ACTIVE'
    db.session.commit()

    log_action(user_id, 'LAB_ENGINE_START', f"Lab: {lab_id}, Session: {session_id}")

    return jsonify({
        'success': True,
        'message': 'Lab session started.',
        'session_id': session_id,
        'container_port': container_port,
        'target_url': target_url,
    })


@api_bp.route('/lab-engine/stop', methods=['POST'])
@limiter.limit("10 per minute")
def lab_engine_stop():
    """Stop a lab session and clean up the container."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    from models import LabSession
    from services.docker_service import stop_uploaded_lab_container
    from services.audit_service import log_action

    data = request.get_json()
    if not data or 'session_id' not in data:
        return jsonify({'success': False, 'message': 'Missing session_id'}), 400

    lab_session = LabSession.query.get(data['session_id'])
    if not lab_session or lab_session.user_id != session['user_id']:
        return jsonify({'success': False, 'message': 'Session not found.'}), 404

    # Stop container
    if lab_session.container_id:
        stop_uploaded_lab_container(lab_session.id, lab_session.container_id)

    lab_session.status = 'EXPIRED'
    db.session.commit()

    log_action(session['user_id'], 'LAB_ENGINE_STOP', f"Session: {lab_session.id}")

    return jsonify({'success': True, 'message': 'Session stopped.'})


@api_bp.route('/lab-engine/progress', methods=['POST'])
@limiter.limit("30 per minute")
def lab_engine_progress():
    """Get full session progress."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    import json
    from models import (LabSession, LabSessionProgress, LabSessionMissionProgress,
                        UploadedLab, UploadedLabMission)

    data = request.get_json()
    if not data or 'session_id' not in data:
        return jsonify({'success': False, 'message': 'Missing session_id'}), 400

    lab_session = LabSession.query.get(data['session_id'])
    if not lab_session or lab_session.user_id != session['user_id']:
        return jsonify({'success': False, 'message': 'Session not found.'}), 404

    progress = lab_session.progress
    mission_progress = LabSessionMissionProgress.query.filter_by(
        session_id=lab_session.id
    ).all()

    # Build mission data with details
    lab = UploadedLab.query.get(lab_session.lab_id)
    missions_data = []
    for mp in mission_progress:
        mission = UploadedLabMission.query.get(mp.mission_id)
        if mission:
            instructions = []
            if mission.instructions:
                try:
                    instructions = json.loads(mission.instructions)
                except (json.JSONDecodeError, TypeError):
                    instructions = [mission.instructions] if mission.instructions else []

            missions_data.append({
                'mission_id': mp.mission_id,
                'mission_number': mission.mission_number,
                'title': mission.title,
                'objective': mission.objective,
                'instructions': instructions,
                'storyline_text': mission.storyline_text or '',
                'points': mission.points,
                'status': mp.status,
                'score': mp.score,
                'questions': [{
                    'question_id': q.id,
                    'question_text': q.question_text,
                    'xp_reward': q.xp_reward,
                } for q in mission.questions],
                'hint_count': len(mission.hints),
            })

    missions_data.sort(key=lambda x: x['mission_number'])

    # Calculate percentage
    completed = sum(1 for mp in mission_progress if mp.status == 'COMPLETED')
    total = len(mission_progress)
    percentage = int((completed / total) * 100) if total > 0 else 0

    return jsonify({
        'success': True,
        'session_id': lab_session.id,
        'lab_id': lab_session.lab_id,
        'status': lab_session.status,
        'start_time': lab_session.start_time.isoformat() + 'Z' if hasattr(lab_session, 'start_time') and lab_session.start_time else None,
        'score': progress.score if progress else 0,
        'total_possible': progress.total_possible if progress else 0,
        'missions_completed': completed,
        'missions_total': total,
        'percentage': percentage,
        'hints_used': progress.hints_used if progress else 0,
        'missions': missions_data,
        'storyline': lab.storyline or '',
        'title': lab.title,
        'category': lab.category,
        'difficulty': lab.difficulty,
        'estimated_time': lab.estimated_time,
    })


@api_bp.route('/lab-engine/submit-answer', methods=['POST'])
@limiter.limit("20 per minute")
def lab_engine_submit_answer():
    """Submit an answer for a mission question (backend validated)."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    from datetime import datetime
    from models import (LabSession, LabSessionProgress, LabSessionMissionProgress,
                        LabSessionQuestionAttempt, UploadedLabQuestion, UploadedLabMission)
    from services.lab_validation_service import ValidationEngine
    from services.audit_service import log_action

    data = request.get_json()
    required = ('session_id', 'mission_id', 'question_id', 'answer')
    if not data or not all(k in data for k in required):
        return jsonify({'success': False, 'message': 'Missing required fields.'}), 400

    lab_session = LabSession.query.get(data['session_id'])
    if not lab_session or lab_session.user_id != session['user_id']:
        return jsonify({'success': False, 'message': 'Session not found.'}), 404

    if lab_session.status != 'ACTIVE':
        return jsonify({'success': False, 'message': 'Session is not active.'}), 400

    # Get question
    question = UploadedLabQuestion.query.get(data['question_id'])
    if not question or question.mission_id != data['mission_id']:
        return jsonify({'success': False, 'message': 'Question not found.'}), 404

    # Validate answer
    result = ValidationEngine.validate_answer(data['answer'], question)

    # Record attempt
    attempt = LabSessionQuestionAttempt(
        session_id=lab_session.id,
        mission_id=data['mission_id'],
        question_id=data['question_id'],
        answer=data['answer'],
        correct=result.correct,
    )
    db.session.add(attempt)

    if result.correct:
        # Check if already answered correctly
        prev_correct = LabSessionQuestionAttempt.query.filter_by(
            session_id=lab_session.id,
            question_id=data['question_id'],
            correct=True,
        ).count()

        if prev_correct <= 1:  # First correct answer (including this one)
            progress = lab_session.progress
            if progress:
                progress.score += question.xp_reward
                db.session.add(progress)

            # Check if all questions in this mission are answered
            mission = UploadedLabMission.query.get(data['mission_id'])
            if mission:
                all_questions = mission.questions
                all_answered = True
                for q in all_questions:
                    correct_attempt = LabSessionQuestionAttempt.query.filter_by(
                        session_id=lab_session.id,
                        question_id=q.id,
                        correct=True,
                    ).first()
                    if not correct_attempt:
                        all_answered = False
                        break

                if all_answered:
                    # Mark mission as completed
                    mp = LabSessionMissionProgress.query.filter_by(
                        session_id=lab_session.id,
                        mission_id=data['mission_id'],
                    ).first()
                    if mp:
                        mp.status = 'COMPLETED'
                        mp.completed_at = datetime.utcnow()
                        mp.score = sum(q.xp_reward for q in all_questions)
                        db.session.add(mp)

                    if progress:
                        progress.missions_completed = LabSessionMissionProgress.query.filter_by(
                            session_id=lab_session.id, status='COMPLETED'
                        ).count()

                    # Unlock next mission
                    next_mission = UploadedLabMission.query.filter_by(
                        lab_id=lab_session.lab_id
                    ).filter(
                        UploadedLabMission.mission_number > mission.mission_number
                    ).order_by(UploadedLabMission.mission_number.asc()).first()

                    if next_mission:
                        next_mp = LabSessionMissionProgress.query.filter_by(
                            session_id=lab_session.id,
                            mission_id=next_mission.id,
                        ).first()
                        if next_mp and next_mp.status == 'LOCKED':
                            next_mp.status = 'AVAILABLE'
                            db.session.add(next_mp)

        log_action(session['user_id'], 'LAB_ENGINE_ANSWER_CORRECT',
                   f"Session: {lab_session.id}, Q: {data['question_id']}")
    else:
        log_action(session['user_id'], 'LAB_ENGINE_ANSWER_WRONG',
                   f"Session: {lab_session.id}, Q: {data['question_id']}")

    db.session.commit()

    return jsonify({
        'success': True,
        'correct': result.correct,
        'message': result.message,
        'explanation': result.explanation if result.correct else '',
        'xp': result.xp if result.correct else 0,
    })


@api_bp.route('/lab-engine/submit-flag', methods=['POST'])
@limiter.limit("10 per minute")
def lab_engine_submit_flag():
    """Submit a flag (backend validated, flag never exposed to frontend)."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    from datetime import datetime
    from models import (LabSession, LabSessionProgress, LabSessionFlagAttempt,
                        LabSessionMissionProgress, UploadedLabFlag)
    from services.lab_validation_service import ValidationEngine
    from services.audit_service import log_action

    data = request.get_json()
    if not data or not all(k in data for k in ('session_id', 'flag')):
        return jsonify({'success': False, 'message': 'Missing required fields.'}), 400

    lab_session = LabSession.query.get(data['session_id'])
    if not lab_session or lab_session.user_id != session['user_id']:
        return jsonify({'success': False, 'message': 'Session not found.'}), 404

    if lab_session.status != 'ACTIVE':
        return jsonify({'success': False, 'message': 'Session is not active.'}), 400

    # Find matching flag
    flags = UploadedLabFlag.query.filter_by(lab_id=lab_session.lab_id).all()
    correct = False
    xp_earned = 0

    for flag in flags:
        result = ValidationEngine.validate_flag(data['flag'], flag)
        if result.correct:
            correct = True
            xp_earned = result.xp
            break

    # Record attempt
    attempt = LabSessionFlagAttempt(
        session_id=lab_session.id,
        user_id=session['user_id'],
        lab_id=lab_session.lab_id,
        mission_id=data.get('mission_id'),
        flag_submitted=data['flag'],
        correct=correct,
    )
    db.session.add(attempt)

    if correct:
        progress = lab_session.progress
        if progress:
            # Only award points once
            prev_correct = LabSessionFlagAttempt.query.filter_by(
                session_id=lab_session.id, correct=True
            ).count()
            if prev_correct <= 1:
                progress.score += xp_earned
                db.session.add(progress)

        # Check if lab is fully completed
        all_missions_done = LabSessionMissionProgress.query.filter_by(
            session_id=lab_session.id
        ).filter(
            LabSessionMissionProgress.status != 'COMPLETED'
        ).count() == 0

        if all_missions_done or True:  # Flag submission can complete the lab
            lab_session.status = 'COMPLETED'
            lab_session.completed_at = datetime.utcnow()

        log_action(session['user_id'], 'LAB_ENGINE_FLAG_SUCCESS',
                   f"Session: {lab_session.id}")
    else:
        log_action(session['user_id'], 'LAB_ENGINE_FLAG_FAILED',
                   f"Session: {lab_session.id}")

    db.session.commit()

    return jsonify({
        'success': True,
        'correct': correct,
        'message': 'Flag accepted! Lab complete!' if correct else 'Incorrect flag. Try again.',
        'xp': xp_earned if correct else 0,
    })


@api_bp.route('/lab-engine/hint', methods=['POST'])
@limiter.limit("20 per minute")
def lab_engine_hint():
    """Request a hint for the current mission."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    from models import (LabSession, LabSessionProgress, UploadedLabHint)
    from services.audit_service import log_action

    data = request.get_json()
    if not data or not all(k in data for k in ('session_id', 'mission_id')):
        return jsonify({'success': False, 'message': 'Missing required fields.'}), 400

    lab_session = LabSession.query.get(data['session_id'])
    if not lab_session or lab_session.user_id != session['user_id']:
        return jsonify({'success': False, 'message': 'Session not found.'}), 404

    # Get hints for this mission
    hints = UploadedLabHint.query.filter_by(
        mission_id=data['mission_id']
    ).order_by(UploadedLabHint.sort_order.asc()).all()

    if not hints:
        return jsonify({'success': False, 'message': 'No hints available for this mission.'})

    # Determine which hint to reveal next based on how many have been requested
    progress = lab_session.progress
    hint_index = data.get('hint_index', 0)

    if hint_index >= len(hints):
        return jsonify({'success': False, 'message': 'All hints have been revealed.'})

    hint = hints[hint_index]

    # Deduct XP cost
    if progress and hint.xp_cost > 0:
        progress.hints_used = (progress.hints_used or 0) + 1
        progress.score = max(0, (progress.score or 0) - hint.xp_cost)
        db.session.add(progress)

    db.session.commit()

    log_action(session['user_id'], 'LAB_ENGINE_HINT_USED',
               f"Session: {lab_session.id}, Mission: {data['mission_id']}")

    return jsonify({
        'success': True,
        'hint_text': hint.hint_text,
        'xp_cost': hint.xp_cost,
        'hint_index': hint_index,
        'total_hints': len(hints),
    })

@api_bp.route('/challenges/submit', methods=['POST'])
@limiter.limit("10 per minute")
def submit_challenge_flag():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json()
    if not data or not all(k in data for k in ("challenge_id", "flag")):
        return jsonify({'success': False, 'message': 'Invalid input'}), 400
        
    challenge_id = data.get('challenge_id')
    flag_val = data.get('flag')
    
    challenge = Challenge.query.get(challenge_id)
    if not challenge:
        return jsonify({'success': False, 'message': 'Challenge not found.'}), 404
        
    if challenge.flag_value == flag_val:
        cp = ChallengeProgress.query.filter_by(user_id=user_id, challenge_id=challenge_id).first()
        if not cp:
            cp = ChallengeProgress(user_id=user_id, challenge_id=challenge_id)
            db.session.add(cp)
            db.session.commit()
        log_action(user_id, 'CHALLENGE_FLAG_SUCCESS', f"Challenge: {challenge_id}")
        return jsonify({'success': True, 'message': 'Flag accepted! Challenge complete.'})
    
    log_action(user_id, 'CHALLENGE_FLAG_FAILED', f"Challenge: {challenge_id}")
    return jsonify({'success': False, 'message': 'Incorrect flag.'})


@api_bp.route('/lab/restart', methods=['POST'])
@limiter.limit("20 per minute")
def restart_lab():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json() or {}
    lab_id = data.get('lab_id')
    if not lab_id:
        return jsonify({'success': False, 'message': 'Missing lab_id'}), 400

    try:
        from models import (Lab, Mission, MissionProgress, LabProgress,
                            EvidenceProgress, Evidence, QuizAttempt, HintUsage, Hint)

        # 1. Reset LabProgress
        lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
        if lp:
            lp.status = 'IN PROGRESS'
            lp.score = 0
            lp.percentage = 0
            lp.completed_at = None

        # 2. Reset MissionProgress + clear QuizAttempts & HintUsage per mission
        missions = Mission.query.filter_by(lab_id=lab_id).order_by(Mission.mission_number.asc()).all()
        mission_ids = [m.id for m in missions]

        for idx, m in enumerate(missions):
            mp = MissionProgress.query.filter_by(user_id=user_id, mission_id=m.id).first()
            if mp:
                mp.status = 'AVAILABLE' if idx == 0 else 'LOCKED'
                mp.completed_at = None
            else:
                mp = MissionProgress(user_id=user_id, lab_id=lab_id, mission_id=m.id,
                                     status='AVAILABLE' if idx == 0 else 'LOCKED')
                db.session.add(mp)

        # 3. Delete quiz attempts for this lab's missions (both mission_id and subtask quiz_id)
        if mission_ids:
            from models import MissionQuiz
            quiz_ids = [q.id for q in MissionQuiz.query.filter(MissionQuiz.mission_id.in_(mission_ids)).all()]
            all_target_ids = list(set(mission_ids + quiz_ids))
            QuizAttempt.query.filter(
                QuizAttempt.user_id == user_id,
                QuizAttempt.mission_id.in_(all_target_ids)
            ).delete(synchronize_session='fetch')

        # 4. Delete hint usage for this lab's missions
        if mission_ids:
            hint_ids = [h.id for h in Hint.query.filter(Hint.mission_id.in_(mission_ids)).all()]
            if hint_ids:
                HintUsage.query.filter(
                    HintUsage.user_id == user_id,
                    HintUsage.hint_id.in_(hint_ids)
                ).delete(synchronize_session='fetch')

        # 5. Reset evidence collection
        evidences = Evidence.query.filter_by(lab_id=lab_id).all()
        for ev in evidences:
            ep = EvidenceProgress.query.filter_by(user_id=user_id, evidence_id=ev.id).first()
            if ep:
                ep.collected = False

        db.session.commit()
        log_action(user_id, 'LAB_RESTART', f"Lab: {lab_id}")
        return jsonify({'success': True, 'message': 'Lab has been restarted.'})

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


@api_bp.route('/manual-lab/restart', methods=['POST'])
@limiter.limit("20 per minute")
def restart_manual_lab():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json() or {}
    lab_id = data.get('lab_id')
    if not lab_id:
        return jsonify({'success': False, 'message': 'Missing lab_id'}), 400

    from models import ManualLabProgress
    from services.docker_service import start_lab_container

    mlp = ManualLabProgress.query.filter_by(user_id=user_id, manual_lab_id=lab_id).first()
    if mlp:
        mlp.status = 'IN PROGRESS'
        mlp.score = 0
        mlp.completed_at = None
        db.session.commit()

    success, ip, port, msg = start_lab_container(user_id, lab_id)
    log_action(user_id, 'MANUAL_LAB_RESTART', f"Lab: {lab_id}")
    return jsonify({'success': True, 'ip': ip, 'port': port, 'message': 'Manual lab restarted.'})


@api_bp.route('/lab-engine/restart', methods=['POST'])
@limiter.limit("20 per minute")
def restart_lab_engine():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.get_json() or {}
    lab_id = data.get('lab_id')
    if not lab_id:
        return jsonify({'success': False, 'message': 'Missing lab_id'}), 400

    from models import LabSession
    from services.docker_service import stop_uploaded_lab_container

    sessions = LabSession.query.filter_by(user_id=user_id, lab_id=lab_id).all()
    for s in sessions:
        if s.container_id:
            try:
                stop_uploaded_lab_container(s.id, s.container_id)
            except Exception:
                pass
        s.status = 'EXPIRED'

    db.session.commit()
    log_action(user_id, 'LAB_ENGINE_RESTART', f"Lab: {lab_id}")
    return jsonify({'success': True, 'message': 'Interactive lab restarted.'})

