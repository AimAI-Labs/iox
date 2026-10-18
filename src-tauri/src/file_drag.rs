/// One gesture: move beyond the system drag threshold, then dwell for one second.
pub struct DragDwell {
    start: (i32, i32),
    threshold: (i32, i32),
    anchor: Option<((i32, i32), u64)>,
    finished: bool,
}

impl DragDwell {
    pub fn new(start: (i32, i32), threshold: (i32, i32)) -> Self {
        Self {
            start,
            threshold,
            anchor: None,
            finished: false,
        }
    }

    pub fn update(&mut self, point: (i32, i32), now_ms: u64, held: bool) -> bool {
        if !held {
            self.finished = true;
        }
        if self.finished {
            return false;
        }
        let Some((anchor, since)) = self.anchor else {
            if (point.0 - self.start.0).abs() > self.threshold.0
                || (point.1 - self.start.1).abs() > self.threshold.1
            {
                self.anchor = Some((point, now_ms));
            }
            return false;
        };
        let dx = i64::from(point.0) - i64::from(anchor.0);
        let dy = i64::from(point.1) - i64::from(anchor.1);
        if dx * dx + dy * dy > 16 {
            self.anchor = Some((point, now_ms));
            return false;
        }
        if now_ms.saturating_sub(since) >= 1000 {
            self.finished = true;
            return true;
        }
        false
    }
}

/// Preview paths alone never authorize reading bytes; a matching native drop is required.
pub struct FileDragSession {
    pub id: u64,
    pub files: Vec<String>,
    dropped: bool,
    claimed: bool,
}

impl FileDragSession {
    pub fn new(id: u64, files: Vec<String>) -> Self {
        Self {
            id,
            files,
            dropped: false,
            claimed: false,
        }
    }

    fn matches(&self, files: &[String]) -> bool {
        !files.is_empty()
            && files.len() == self.files.len()
            && self.files.iter().all(|expected| {
                files
                    .iter()
                    .filter(|actual| actual.eq_ignore_ascii_case(expected))
                    .count()
                    == 1
            })
    }

    pub fn accept_drop(&mut self, files: &[String]) -> bool {
        if self.dropped || !self.matches(files) {
            return false;
        }
        self.dropped = true;
        true
    }

    pub fn claim(&mut self, id: u64, files: &[String]) -> Result<(), String> {
        if self.id != id || !self.dropped || self.claimed || !self.matches(files) {
            return Err("文件拖放已失效，请重新拖入文件".into());
        }
        self.claimed = true;
        Ok(())
    }

    pub fn allow_retry(&mut self, id: u64) {
        if self.id == id {
            self.claimed = false;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn click_and_stationary_hold_do_not_start_a_drag() {
        let mut dwell = DragDwell::new((10, 10), (4, 4));
        assert!(!dwell.update((10, 10), 2000, true));
        assert!(!dwell.update((11, 11), 3000, true));
        assert!(!dwell.update((11, 11), 4000, false));
    }

    #[test]
    fn requires_a_full_second_after_drag_and_only_fires_once() {
        let mut dwell = DragDwell::new((0, 0), (4, 4));
        assert!(!dwell.update((20, 20), 50, true));
        assert!(!dwell.update((20, 20), 1049, true));
        assert!(dwell.update((20, 20), 1050, true));
        assert!(!dwell.update((20, 20), 2050, true));
    }

    #[test]
    fn movement_resets_dwell_but_small_jitter_does_not() {
        let mut dwell = DragDwell::new((0, 0), (4, 4));
        assert!(!dwell.update((20, 20), 0, true));
        assert!(!dwell.update((30, 20), 900, true));
        assert!(!dwell.update((32, 21), 1800, true));
        assert!(dwell.update((31, 20), 1900, true));
    }

    #[test]
    fn releasing_before_dwell_cancels_the_gesture() {
        let mut dwell = DragDwell::new((0, 0), (4, 4));
        assert!(!dwell.update((20, 20), 0, true));
        assert!(!dwell.update((20, 20), 999, false));
        assert!(!dwell.update((20, 20), 2000, true));
    }

    fn files() -> Vec<String> {
        vec![r"C:\one.txt".into(), r"C:\two.pdf".into()]
    }

    #[test]
    fn hover_alone_and_stale_ids_cannot_authorize_an_action() {
        let mut session = FileDragSession::new(7, files());
        assert!(session.claim(7, &files()).is_err());
        assert!(session.accept_drop(&files()));
        assert!(session.claim(6, &files()).is_err());
        assert!(session.claim(7, &files()).is_ok());
        assert!(session.claim(7, &files()).is_err());
    }

    #[test]
    fn actual_drop_must_match_preview_paths_without_duplicates() {
        let mut session = FileDragSession::new(7, files());
        assert!(!session.accept_drop(&[r"C:\other.txt".into()]));
        assert!(!session.accept_drop(&[files()[0].clone(), files()[0].clone()]));
        assert!(!session.accept_drop(&[]));
        assert!(session.accept_drop(&[r"c:\TWO.pdf".into(), r"c:\ONE.txt".into()]));
        assert!(session.claim(7, &files()).is_ok());
    }

    #[test]
    fn errors_allow_retry_only_for_the_same_accepted_drop() {
        let mut session = FileDragSession::new(7, files());
        assert!(session.accept_drop(&files()));
        assert!(session.claim(7, &files()).is_ok());
        session.allow_retry(6);
        assert!(session.claim(7, &files()).is_err());
        session.allow_retry(7);
        assert!(session.claim(7, &files()).is_ok());
        assert!(session.claim(7, &[files()[0].clone()]).is_err());
    }
}
