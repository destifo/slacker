use std::collections::HashSet;

use crate::models::task::TaskStatus;

pub fn eval_status_from_reactions(statuses: HashSet<TaskStatus>) -> TaskStatus {
    if statuses.contains(&TaskStatus::Completed) {
        return TaskStatus::Completed;
    }

    if statuses.contains(&TaskStatus::Blocked) {
        return TaskStatus::Blocked;
    }

    if statuses.contains(&TaskStatus::InProgress) {
        return TaskStatus::InProgress;
    }

    TaskStatus::Blank
}
