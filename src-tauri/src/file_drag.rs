#[derive(Clone, serde::Serialize)]
pub struct FileMenuButton {
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
}

/// Shared geometry for the native window and its frontend drop targets.
#[derive(Clone, serde::Serialize)]
pub struct FileMenuLayout {
    pub width: f64,
    pub height: f64,
    pub buttons: Vec<FileMenuButton>,
}

impl FileMenuLayout {
    pub fn new(count: usize) -> Self {
        let mut buttons = Vec::with_capacity(count);
        let columns = count.min(7);
        for row_start in (0..count).step_by(7) {
            let row_count = (count - row_start).min(7);
            for index in 0..row_count {
                let offset = index as f64 - (row_count - 1) as f64 / 2.0;
                buttons.push(FileMenuButton {
                    x: (index * 64 + (columns - row_count) * 32) as f64,
                    y: (row_start / 7 * 116) as f64 + offset * offset * 2.0,
                    rotation: offset * 5.0,
                });
            }
        }
        // Include the rotated corners so shadows and raised cards remain inside the window.
        let extent = |b: &FileMenuButton| {
            let angle = b.rotation.to_radians();
            40.0 * (angle.cos().abs() + angle.sin().abs())
        };
        let min_x = buttons
            .iter()
            .map(|b| b.x + 40.0 - extent(b))
            .reduce(f64::min)
            .unwrap_or(0.0);
        let max_x = buttons
            .iter()
            .map(|b| b.x + 40.0 + extent(b))
            .reduce(f64::max)
            .unwrap_or(80.0);
        let min_y = buttons
            .iter()
            .map(|b| b.y + 40.0 - extent(b))
            .reduce(f64::min)
            .unwrap_or(0.0);
        let max_y = buttons
            .iter()
            .map(|b| b.y + 40.0 + extent(b))
            .reduce(f64::max)
            .unwrap_or(80.0);
        for button in &mut buttons {
            button.x += 12.0 - min_x;
            button.y += 12.0 - min_y;
        }
        Self {
            width: (max_x - min_x + 24.0).ceil(),
            height: (max_y - min_y + 24.0).ceil(),
            buttons,
        }
    }
}

/// One gesture: move beyond the system drag threshold, then dwell for the configured delay.
pub struct DragDwell {
    start: (i32, i32),
    threshold: (i32, i32),
    delay_ms: u64,
    anchor: Option<((i32, i32), u64)>,
    finished: bool,
}

impl DragDwell {
    pub fn new(start: (i32, i32), threshold: (i32, i32), delay_ms: u64) -> Self {
        Self {
            start,
            threshold,
            delay_ms: delay_ms.clamp(200, 3000),
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
        if now_ms.saturating_sub(since) >= self.delay_ms {
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
    fn stacked_menu_keeps_every_card_center_exposed_and_corners_inside() {
        for count in 1..=40 {
            let layout = FileMenuLayout::new(count);
            assert_eq!(layout.buttons.len(), count);
            for (index, button) in layout.buttons.iter().enumerate() {
                let angle = button.rotation.to_radians();
                let extent = 40.0 * (angle.cos().abs() + angle.sin().abs());
                assert!(button.x + 40.0 - extent >= 8.0);
                assert!(button.y + 40.0 - extent >= 8.0);
                assert!(button.x + 40.0 + extent <= layout.width);
                assert!(button.y + 40.0 + extent <= layout.height);
                for other in &layout.buttons[index + 1..] {
                    let angle = other.rotation.to_radians();
                    let dx = button.x - other.x;
                    let dy = button.y - other.y;
                    assert!(
                        (dx * angle.cos() + dy * angle.sin()).abs() > 40.0
                            || (-dx * angle.sin() + dy * angle.cos()).abs() > 40.0,
                        "Covered card center for {count} actions"
                    );
                }
            }
        }
    }

    #[test]
    fn five_ai_buttons_form_an_upward_arc() {
        let layout = FileMenuLayout::new(5);
        assert!(
            layout.width < 400.0 && layout.height < 150.0,
            "The card fan should be compact"
        );
        assert!(
            layout.buttons[1].x - layout.buttons[0].x < 80.0,
            "Neighboring cards should overlap"
        );
        assert!(layout.buttons[2].y < layout.buttons[0].y);
        assert!((layout.buttons[0].y - layout.buttons[4].y).abs() < 0.01);
        assert!(layout.buttons.windows(2).all(|pair| pair[0].x < pair[1].x));
    }

    #[test]
    fn click_and_stationary_hold_do_not_start_a_drag() {
        let mut dwell = DragDwell::new((10, 10), (4, 4), 1000);
        assert!(!dwell.update((10, 10), 2000, true));
        assert!(!dwell.update((11, 11), 3000, true));
        assert!(!dwell.update((11, 11), 4000, false));
    }

    #[test]
    fn requires_a_full_second_after_drag_and_only_fires_once() {
        let mut dwell = DragDwell::new((0, 0), (4, 4), 1000);
        assert!(!dwell.update((20, 20), 50, true));
        assert!(!dwell.update((20, 20), 1049, true));
        assert!(dwell.update((20, 20), 1050, true));
        assert!(!dwell.update((20, 20), 2050, true));
    }

    #[test]
    fn uses_custom_hover_delays_and_clamps_out_of_range_values() {
        for (configured, effective) in [(500, 500), (1700, 1700), (0, 200), (u64::MAX, 3000)] {
            let mut dwell = DragDwell::new((0, 0), (4, 4), configured);
            assert!(!dwell.update((20, 20), 50, true));
            assert!(!dwell.update((20, 20), 50 + effective - 1, true));
            assert!(dwell.update((20, 20), 50 + effective, true));
            assert!(!dwell.update((20, 20), 5000, true));
        }
    }

    #[test]
    fn movement_restarts_the_configured_hover_delay() {
        let mut dwell = DragDwell::new((0, 0), (4, 4), 500);
        assert!(!dwell.update((20, 20), 0, true));
        assert!(!dwell.update((30, 20), 400, true));
        assert!(!dwell.update((30, 20), 899, true));
        assert!(dwell.update((30, 20), 900, true));
    }

    #[test]
    fn movement_resets_dwell_but_small_jitter_does_not() {
        let mut dwell = DragDwell::new((0, 0), (4, 4), 1000);
        assert!(!dwell.update((20, 20), 0, true));
        assert!(!dwell.update((30, 20), 900, true));
        assert!(!dwell.update((32, 21), 1800, true));
        assert!(dwell.update((31, 20), 1900, true));
    }

    #[test]
    fn releasing_before_dwell_cancels_the_gesture() {
        let mut dwell = DragDwell::new((0, 0), (4, 4), 1000);
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
