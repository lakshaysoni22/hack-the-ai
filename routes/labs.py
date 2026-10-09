from flask import Blueprint, render_template, redirect, url_for, session
from extensions import db
from models import Lab, LabProgress, ManualLab, ManualLabProgress, Mission, MissionProgress, EvidenceProgress, Evidence, MissionQuiz

labs_bp = Blueprint('labs', __name__)


def is_lab_locked_for_user(user_id, lab):
    """A lab is locked until every published lab earlier in the learning
    path (lower sort_order) has been completed - or at least started - by
    this user. Shared between the labs list, the detail/play pages, and
    the session-start API so the gate can't be bypassed by URL."""
    from models import UploadedLab, LabSession

    earlier_labs = UploadedLab.query.filter(
        UploadedLab.status == 'published',
        UploadedLab.sort_order < lab.sort_order,
    ).all()

    for earlier in earlier_labs:
        earlier_session = LabSession.query.filter_by(
            user_id=user_id, lab_id=earlier.id
        ).order_by(LabSession.start_time.desc()).first()
        if not earlier_session or earlier_session.status not in ('COMPLETED', 'ACTIVE'):
            return True
    return False


@labs_bp.route('/labs')
def labs():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_id = session['user_id']
    
    labs_data = db.session.query(
        Lab.id, Lab.name, Lab.topic, Lab.difficulty, LabProgress.status
    ).outerjoin(
        LabProgress, (Lab.id == LabProgress.lab_id) & (LabProgress.user_id == user_id)
    ).all()
    
    lab_meta = {
        'lab6': {
            'description': 'A simulated enterprise AI-blockchain breach investigation. Uncover unauthorized fund transfers, investigate poisoned AI context, trace compromised RBAC permissions, and contain a sophisticated cross-chain adversary.',
            'xp': 250,
            'case_id': 'NEX-042',
            'pro_num': 'PRO 01'
        },
        'lab7': {
            'description': 'An impossible block exposes a hidden attack on blockchain consensus. Trace poisoned oracle data, corrupted AI signals, and a silent validator divergence before the network loses agreement.',
            'xp': 300,
            'case_id': 'NEX-071',
            'pro_num': 'PRO 02'
        }
    }

    labs_list = [{
        'id': l.id,
        'name': l.name,
        'topic': l.topic,
        'difficulty': l.difficulty,
        'status': l.status,
        'description': lab_meta.get(l.id, {}).get('description', 'A challenging interactive lab environment.'),
        'xp': lab_meta.get(l.id, {}).get('xp', 250),
        'case_id': lab_meta.get(l.id, {}).get('case_id', ''),
        'pro_num': lab_meta.get(l.id, {}).get('pro_num', '')
    } for l in labs_data]
    
    return render_template('labs.html', labs=labs_list)

@labs_bp.route('/lab/<lab_id>')
def lab_detail(lab_id):
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_id = session['user_id']
    lab = db.session.get(Lab, lab_id)
    if not lab:
        return redirect(url_for('labs.labs'))
    
    # Get missions for this lab
    missions_data = db.session.query(
        Mission.id, Mission.mission_number, Mission.title, Mission.description, MissionProgress.status
    ).outerjoin(
        MissionProgress, (Mission.id == MissionProgress.mission_id) & (MissionProgress.user_id == user_id)
    ).filter(
        Mission.lab_id == lab_id
    ).order_by(Mission.mission_number.asc()).all()
    
    missions = [{'id': m.id, 'mission_number': m.mission_number, 'title': m.title, 'description': m.description, 'status': m.status or ('AVAILABLE' if m.mission_number == 1 else 'LOCKED')} for m in missions_data]
    
    return render_template('lab_detail.html', lab=lab, lab_id=lab_id, missions=missions)

@labs_bp.route('/manual-labs')
def manual_labs():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_id = session['user_id']
    
    labs_data = db.session.query(
        ManualLab.id, ManualLab.name, ManualLab.topic, ManualLab.difficulty, ManualLab.target_type, ManualLabProgress.status
    ).outerjoin(
        ManualLabProgress, (ManualLab.id == ManualLabProgress.manual_lab_id) & (ManualLabProgress.user_id == user_id)
    ).all()
    
    labs_list = [{'id': l.id, 'name': l.name, 'topic': l.topic, 'difficulty': l.difficulty, 'target_type': l.target_type, 'status': l.status} for l in labs_data]
    return render_template('manual_labs.html', labs=labs_list)

@labs_bp.route('/manual-lab/<lab_id>')
def manual_lab_detail(lab_id):
    lab = ManualLab.query.get(lab_id)
    return render_template('manual_lab_detail.html', lab=lab, lab_id=lab_id)

@labs_bp.route('/manual-lab/<lab_id>/environment')
def manual_lab_environment(lab_id):
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    lab = ManualLab.query.get(lab_id)
    return render_template('manual_lab_environment.html', lab=lab, lab_id=lab_id)

@labs_bp.route('/lab/<lab_id>/workstation')
def workstation(lab_id):
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    if str(lab_id).lower() in ('lab6', 'ghost-in-the-ledger', 'ghost_in_the_ledger', 'the-ghost-in-the-ledger'):
        return redirect(url_for('labs.ghost_ledger_workstation'))
    if str(lab_id).lower() in ('lab7', 'vanishing-consensus', 'vanishing_consensus', 'the-vanishing-consensus'):
        return redirect(url_for('labs.vanishing_consensus_workstation'))
    user_id = session['user_id']
    
    # Get missions for this lab
    missions_data = db.session.query(
        Mission.id, Mission.mission_number, Mission.title, Mission.description, MissionProgress.status
    ).join(
        MissionProgress, Mission.id == MissionProgress.mission_id
    ).filter(
        Mission.lab_id == lab_id,
        MissionProgress.user_id == user_id
    ).order_by(Mission.mission_number.asc()).all()
    
    missions = [{'id': m.id, 'mission_number': m.mission_number, 'title': m.title, 'description': m.description, 'status': m.status} for m in missions_data]
    
    # Get active mission
    active_mission = None
    for m in missions:
        if m['status'] in ('AVAILABLE', 'IN PROGRESS'):
            active_mission = m
            break
            
    # Get evidence collected for Phase 3 fix
    evidence_collected = db.session.query(EvidenceProgress).join(Evidence).filter(
        EvidenceProgress.user_id == user_id,
        Evidence.lab_id == lab_id,
        EvidenceProgress.collected == True
    ).count()
    
    return render_template('workstation.html', lab_id=lab_id, missions=missions, active_mission=active_mission, evidence_collected=evidence_collected)


# =========================================================================
# PRO Lab 01 — The Ghost in the Ledger (Custom Workstation)
# =========================================================================

@labs_bp.route('/lab/lab6/investigation')
def ghost_ledger_workstation():
    """Custom investigation workstation for PRO Lab 01."""
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_id = session['user_id']
    lab_id = 'lab6'

    from services.progress_service import update_unlocks
    update_unlocks(user_id)
    db.session.commit()

    # Ensure LabProgress exists
    lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
    if not lp:
        lp = LabProgress(user_id=user_id, lab_id=lab_id, status='AVAILABLE')
        db.session.add(lp)
    elif lp.status == 'LOCKED':
        lp.status = 'AVAILABLE'
    db.session.commit()

    # Ensure all 5 missions exist in MissionProgress
    lab_missions = Mission.query.filter_by(lab_id=lab_id).order_by(Mission.mission_number.asc()).all()
    for idx, m in enumerate(lab_missions):
        mp = MissionProgress.query.filter_by(user_id=user_id, mission_id=m.id).first()
        if not mp:
            init_status = 'AVAILABLE' if idx == 0 else 'LOCKED'
            mp = MissionProgress(user_id=user_id, lab_id=lab_id, mission_id=m.id, status=init_status)
            db.session.add(mp)
        elif idx == 0 and mp.status == 'LOCKED':
            mp.status = 'AVAILABLE'
    db.session.commit()

    # Re-run unlock evaluation in case missions were freshly created
    update_unlocks(user_id)
    db.session.commit()

    from models import QuizAttempt

    # Get missions for lab6
    missions_data = db.session.query(
        Mission.id, Mission.mission_number, Mission.title, Mission.description, MissionProgress.status
    ).join(
        MissionProgress, Mission.id == MissionProgress.mission_id
    ).filter(
        Mission.lab_id == lab_id,
        MissionProgress.user_id == user_id
    ).order_by(Mission.mission_number.asc()).all()

    missions = []
    for m in missions_data:
        quizzes = MissionQuiz.query.filter_by(mission_id=m.id).order_by(MissionQuiz.id.asc()).all()
        quiz_ids = [q.id for q in quizzes]
        solved_ids = set()
        if quiz_ids:
            solved_attempts = QuizAttempt.query.filter(
                QuizAttempt.user_id == user_id,
                QuizAttempt.mission_id.in_(quiz_ids),
                QuizAttempt.correct == True
            ).all()
            solved_ids = {a.mission_id for a in solved_attempts}

        quizzes_list = []
        for idx, q in enumerate(quizzes):
            quizzes_list.append({
                'id': q.id,
                'index': idx + 1,
                'question': q.question,
                'xp_reward': q.xp_reward,
                'explanation': q.explanation,
                'is_solved': q.id in solved_ids or m.status == 'COMPLETED'
            })

        missions.append({
            'id': m.id,
            'mission_number': m.mission_number,
            'title': m.title,
            'description': m.description,
            'status': m.status,
            'quizzes': quizzes_list,
            'total_quizzes': len(quizzes_list),
            'solved_quizzes_count': len([q for q in quizzes_list if q['is_solved']])
        })

    # Get active mission
    active_mission = None
    for m in missions:
        if m['status'] in ('AVAILABLE', 'IN PROGRESS'):
            active_mission = m
            break

    # Get evidence collected
    evidence_collected = db.session.query(EvidenceProgress).join(Evidence).filter(
        EvidenceProgress.user_id == user_id,
        Evidence.lab_id == lab_id,
        EvidenceProgress.collected == True
    ).count()

    ch5_completed = len(missions) >= 5 and missions[4]['status'] == 'COMPLETED'
    all_completed = len(missions) == 5 and all(m['status'] == 'COMPLETED' for m in missions)
    lab_completed = (lp and lp.status == 'COMPLETED')

    return render_template('ghost_ledger_workstation.html',
                           lab_id=lab_id,
                           missions=missions,
                           active_mission=active_mission,
                           evidence_collected=evidence_collected,
                           ch5_completed=ch5_completed,
                           all_completed=all_completed,
                           lab_completed=lab_completed)


@labs_bp.route('/lab/lab6/post-investigation')
@labs_bp.route('/lab/lab6/case-file')
def ghost_ledger_post_investigation():
    """Cinematic post-investigation experience for PRO Lab 01 (Case NEX-042)."""
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_id = session['user_id']
    lab_id = 'lab6'

    lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
    evidence_collected = db.session.query(EvidenceProgress).join(Evidence).filter(
        EvidenceProgress.user_id == user_id,
        Evidence.lab_id == lab_id,
        EvidenceProgress.collected == True
    ).count()

    missions_data = db.session.query(
        Mission.id, Mission.mission_number, Mission.title, MissionProgress.status
    ).join(
        MissionProgress, Mission.id == MissionProgress.mission_id
    ).filter(
        Mission.lab_id == lab_id,
        MissionProgress.user_id == user_id
    ).order_by(Mission.mission_number.asc()).all()

    all_completed = len(missions_data) == 5 and all(m.status == 'COMPLETED' for m in missions_data)
    lab_completed = (lp and lp.status == 'COMPLETED')

    return render_template('ghost_ledger_post_investigation.html',
                           lab_id=lab_id,
                           evidence_collected=evidence_collected,
                           all_completed=all_completed,
                           lab_completed=lab_completed)


# =========================================================================
# PRO Lab 02 — The Vanishing Consensus (Custom Workstation)
# =========================================================================

@labs_bp.route('/lab/lab7/investigation')
@labs_bp.route('/lab/vanishing-consensus')
def vanishing_consensus_workstation():
    """Custom investigation workstation for PRO Lab 02 (Case NEX-071)."""
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_id = session['user_id']
    lab_id = 'lab7'

    from services.progress_service import update_unlocks
    update_unlocks(user_id)
    db.session.commit()

    # Ensure LabProgress exists
    lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
    if not lp:
        lp = LabProgress(user_id=user_id, lab_id=lab_id, status='AVAILABLE')
        db.session.add(lp)
    elif lp.status == 'LOCKED':
        lp.status = 'AVAILABLE'
    db.session.commit()

    # Ensure all 5 missions exist in MissionProgress
    lab_missions = Mission.query.filter_by(lab_id=lab_id).order_by(Mission.mission_number.asc()).all()
    for idx, m in enumerate(lab_missions):
        mp = MissionProgress.query.filter_by(user_id=user_id, mission_id=m.id).first()
        if not mp:
            init_status = 'AVAILABLE' if idx == 0 else 'LOCKED'
            mp = MissionProgress(user_id=user_id, lab_id=lab_id, mission_id=m.id, status=init_status)
            db.session.add(mp)
        elif idx == 0 and mp.status == 'LOCKED':
            mp.status = 'AVAILABLE'
    db.session.commit()

    # Re-run unlock evaluation in case missions were freshly created
    update_unlocks(user_id)
    db.session.commit()

    from models import QuizAttempt

    # Get missions for lab7
    missions_data = db.session.query(
        Mission.id, Mission.mission_number, Mission.title, Mission.description, MissionProgress.status
    ).join(
        MissionProgress, Mission.id == MissionProgress.mission_id
    ).filter(
        Mission.lab_id == lab_id,
        MissionProgress.user_id == user_id
    ).order_by(Mission.mission_number.asc()).all()

    missions = []
    for m in missions_data:
        quizzes = MissionQuiz.query.filter_by(mission_id=m.id).order_by(MissionQuiz.id.asc()).all()
        quiz_ids = [q.id for q in quizzes]
        solved_ids = set()
        if quiz_ids:
            solved_attempts = QuizAttempt.query.filter(
                QuizAttempt.user_id == user_id,
                QuizAttempt.mission_id.in_(quiz_ids),
                QuizAttempt.correct == True
            ).all()
            solved_ids = {a.mission_id for a in solved_attempts}

        quizzes_list = []
        for idx, q in enumerate(quizzes):
            quizzes_list.append({
                'id': q.id,
                'index': idx + 1,
                'question': q.question,
                'xp_reward': q.xp_reward,
                'explanation': q.explanation,
                'is_solved': q.id in solved_ids or m.status == 'COMPLETED'
            })

        missions.append({
            'id': m.id,
            'mission_number': m.mission_number,
            'title': m.title,
            'description': m.description,
            'status': m.status,
            'quizzes': quizzes_list,
            'total_quizzes': len(quizzes_list),
            'solved_quizzes_count': len([q for q in quizzes_list if q['is_solved']])
        })

    # Get active mission
    active_mission = None
    for m in missions:
        if m['status'] in ('AVAILABLE', 'IN PROGRESS'):
            active_mission = m
            break

    # Get evidence collected
    evidence_collected = db.session.query(EvidenceProgress).join(Evidence).filter(
        EvidenceProgress.user_id == user_id,
        Evidence.lab_id == lab_id,
        EvidenceProgress.collected == True
    ).count()

    ch5_completed = len(missions) >= 5 and missions[4]['status'] == 'COMPLETED'
    all_completed = len(missions) == 5 and all(m['status'] == 'COMPLETED' for m in missions)
    lab_completed = (lp and lp.status == 'COMPLETED')

    return render_template('vanishing_consensus_workstation.html',
                           lab_id=lab_id,
                           missions=missions,
                           active_mission=active_mission,
                           evidence_collected=evidence_collected,
                           ch5_completed=ch5_completed,
                           all_completed=all_completed,
                           lab_completed=lab_completed)


@labs_bp.route('/lab/lab7/post-investigation')
@labs_bp.route('/lab/vanishing-consensus/case-file')
def vanishing_consensus_post_investigation():
    """Cinematic post-investigation experience for PRO Lab 02 (Case NEX-071)."""
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_id = session['user_id']
    lab_id = 'lab7'

    lp = LabProgress.query.filter_by(user_id=user_id, lab_id=lab_id).first()
    evidence_collected = db.session.query(EvidenceProgress).join(Evidence).filter(
        EvidenceProgress.user_id == user_id,
        Evidence.lab_id == lab_id,
        EvidenceProgress.collected == True
    ).count()

    missions_data = db.session.query(
        Mission.id, Mission.mission_number, Mission.title, MissionProgress.status
    ).join(
        MissionProgress, Mission.id == MissionProgress.mission_id
    ).filter(
        Mission.lab_id == lab_id,
        MissionProgress.user_id == user_id
    ).order_by(Mission.mission_number.asc()).all()

    all_completed = len(missions_data) == 5 and all(m.status == 'COMPLETED' for m in missions_data)
    lab_completed = (lp and lp.status == 'COMPLETED')

    return render_template('vanishing_consensus_post_investigation.html',
                           lab_id=lab_id,
                           evidence_collected=evidence_collected,
                           all_completed=all_completed,
                           lab_completed=lab_completed)




# =========================================================================
# Interactive Labs (ZIP-to-Interactive Lab Engine)
# =========================================================================

@labs_bp.route('/interactive-labs')
def interactive_labs():
    """List all published uploaded labs."""
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))

    from models import UploadedLab, LabSession
    user_id = session['user_id']

    labs = UploadedLab.query.filter_by(status='published').order_by(
        UploadedLab.sort_order.asc(), UploadedLab.created_at.asc()
    ).all()

    labs_list = []
    for lab in labs:
        user_session = LabSession.query.filter_by(
            user_id=user_id, lab_id=lab.id
        ).order_by(LabSession.start_time.desc()).first()

        lab_status = 'not_started'
        if user_session:
            if user_session.status == 'COMPLETED':
                lab_status = 'completed'
            elif user_session.status == 'ACTIVE':
                lab_status = 'in_progress'

        labs_list.append({
            'id': lab.id,
            'title': lab.title,
            'category': lab.category,
            'difficulty': lab.difficulty,
            'concept': lab.concept,
            'description': lab.description,
            'estimated_time': lab.estimated_time,
            'total_points': lab.total_points,
            'mission_count': len(lab.missions),
            'status': lab_status,
            'locked': lab_status == 'not_started' and is_lab_locked_for_user(user_id, lab),
            'session_id': user_session.id if user_session else None,
        })

    return render_template('interactive_labs.html', labs=labs_list)


@labs_bp.route('/interactive-lab/<lab_id>')
def interactive_lab_detail(lab_id):
    """Lab overview before starting."""
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))

    from models import UploadedLab, LabSession
    user_id = session['user_id']

    lab = UploadedLab.query.get_or_404(lab_id)
    if lab.status != 'published':
        return redirect(url_for('labs.interactive_labs'))

    user_session = LabSession.query.filter_by(
        user_id=user_id, lab_id=lab_id
    ).order_by(LabSession.start_time.desc()).first()

    if not user_session and is_lab_locked_for_user(user_id, lab):
        return redirect(url_for('labs.interactive_labs'))

    return render_template('interactive_lab_detail.html',
                           lab=lab,
                           user_session=user_session)


@labs_bp.route('/interactive-lab/<lab_id>/play')
def interactive_lab_play(lab_id):
    """The main two-panel lab environment."""
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))

    from models import UploadedLab, LabSession
    user_id = session['user_id']

    lab = UploadedLab.query.get_or_404(lab_id)
    if lab.status != 'published':
        return redirect(url_for('labs.interactive_labs'))

    has_session = LabSession.query.filter_by(user_id=user_id, lab_id=lab_id).first() is not None
    if not has_session and is_lab_locked_for_user(user_id, lab):
        return redirect(url_for('labs.interactive_labs'))

    return render_template('interactive_lab_play.html', lab=lab, lab_id=lab_id)

