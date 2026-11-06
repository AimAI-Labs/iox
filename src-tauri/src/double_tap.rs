//! Pure keyboard gesture detection; timestamps are the hook's wrapping millisecond clock.

#[derive(Default)]
pub(crate) struct DoubleTap {
    identity: ((usize, u64), u16),
    down_at: Option<u32>,
    first_release: Option<u32>,
    held_keys: [u64; 4],
}

impl DoubleTap {
    pub fn sync_pressed_keys(&mut self, mut is_down: impl FnMut(u16) -> bool) {
        for key in 0..256u16 {
            let word = &mut self.held_keys[usize::from(key / 64)];
            let mask = 1u64 << (key % 64);
            if *word & mask != 0 && !is_down(key) {
                *word &= !mask;
            }
        }
    }

    pub fn key(
        &mut self,
        key: u16,
        down: bool,
        time: u32,
        target: (usize, u64),
        configured: u16,
        modified: bool,
    ) -> bool {
        const INTERVAL_MS: u32 = 400;
        let Some(held) = self.held_keys.get_mut(usize::from(key / 64)) else {
            return false;
        };
        let mask = 1u64 << (key % 64);
        let repeated = *held & mask != 0;
        if down {
            *held |= mask;
        } else {
            *held &= !mask;
        }
        let identity = (target, configured);
        if self.identity != identity {
            self.identity = identity;
            self.down_at = None;
            self.first_release = None;
        }
        let other_held = self.held_keys.iter().enumerate().any(|(index, held)| {
            let own_key = if index == usize::from(configured / 64) {
                1u64 << (configured % 64)
            } else {
                0
            };
            held & !own_key != 0
        });
        if target.0 == 0 || configured == 0 || modified || other_held || (key != configured && down)
        {
            self.down_at = None;
            self.first_release = None;
            return false;
        }
        if key != configured {
            return false;
        }
        if down {
            // Auto-repeat does not restart the hold clock or count as another tap.
            if !repeated {
                self.down_at = Some(time);
            }
            return false;
        }
        let Some(start) = self.down_at.take() else {
            return false;
        };
        if time.wrapping_sub(start) > INTERVAL_MS {
            self.first_release = None;
            return false;
        }
        if self
            .first_release
            .take()
            .is_some_and(|first| time.wrapping_sub(first) <= INTERVAL_MS)
        {
            return true;
        }
        self.first_release = Some(time);
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LEFT_CTRL: u16 = 0xa2;
    const RIGHT_CTRL: u16 = 0xa3;
    const TARGET: (usize, u64) = (1, 1);

    fn event(tap: &mut DoubleTap, key: u16, down: bool, time: u32) -> bool {
        tap.key(key, down, time, TARGET, LEFT_CTRL, false)
    }

    fn press(tap: &mut DoubleTap, time: u32) -> bool {
        assert!(!event(tap, LEFT_CTRL, true, time));
        event(tap, LEFT_CTRL, false, time.wrapping_add(40))
    }

    #[test]
    fn two_complete_taps_fire_once_then_require_a_new_pair() {
        let mut tap = DoubleTap::default();
        assert!(!press(&mut tap, 10));
        assert!(press(&mut tap, 160));
        assert!(!press(&mut tap, 250));
        assert!(press(&mut tap, 360));
    }

    #[test]
    fn right_ctrl_and_slow_taps_do_not_match_left_ctrl() {
        let mut tap = DoubleTap::default();
        assert!(!press(&mut tap, 10));
        assert!(!event(&mut tap, RIGHT_CTRL, true, 100));
        assert!(!event(&mut tap, RIGHT_CTRL, false, 140));
        assert!(!press(&mut tap, 180));
        assert!(!press(&mut tap, 700));
        assert!(press(&mut tap, 800));
    }

    #[test]
    fn repeats_do_not_count_and_long_holds_cancel() {
        let mut tap = DoubleTap::default();
        assert!(!event(&mut tap, LEFT_CTRL, true, 10));
        assert!(!event(&mut tap, LEFT_CTRL, true, 20));
        assert!(!event(&mut tap, LEFT_CTRL, true, 30));
        assert!(!event(&mut tap, LEFT_CTRL, false, 50));
        assert!(press(&mut tap, 100));
        assert!(!event(&mut tap, LEFT_CTRL, true, 200));
        assert!(!event(&mut tap, LEFT_CTRL, true, 600));
        assert!(!event(&mut tap, LEFT_CTRL, false, 700));
        assert!(!press(&mut tap, 750));
    }

    #[test]
    fn combinations_and_intervening_keys_cancel_the_pair() {
        let mut tap = DoubleTap::default();
        assert!(!press(&mut tap, 10));
        assert!(!event(&mut tap, LEFT_CTRL, true, 100));
        assert!(!event(&mut tap, b'C' as u16, true, 110));
        assert!(!event(&mut tap, b'C' as u16, false, 120));
        assert!(!event(&mut tap, LEFT_CTRL, false, 130));
        assert!(!press(&mut tap, 160));
        assert!(!tap.key(LEFT_CTRL, true, 220, TARGET, LEFT_CTRL, true));
        assert!(!event(&mut tap, LEFT_CTRL, false, 240));
        assert!(!press(&mut tap, 280));
    }

    #[test]
    fn repeat_after_a_combination_cannot_rearm_the_held_key() {
        let mut tap = DoubleTap::default();
        assert!(!event(&mut tap, LEFT_CTRL, true, 10));
        assert!(!event(&mut tap, b'C' as u16, true, 20));
        assert!(!event(&mut tap, b'C' as u16, false, 30));
        assert!(!event(&mut tap, LEFT_CTRL, true, 40));
        assert!(!event(&mut tap, LEFT_CTRL, false, 50));
        assert!(!press(&mut tap, 100));
    }

    #[test]
    fn repeat_after_focus_change_cannot_become_a_fresh_tap() {
        let mut tap = DoubleTap::default();
        assert!(!event(&mut tap, LEFT_CTRL, true, 10));
        assert!(!tap.key(LEFT_CTRL, true, 20, (1, 2), LEFT_CTRL, false));
        assert!(!tap.key(LEFT_CTRL, false, 30, (1, 2), LEFT_CTRL, false));
        assert!(!tap.key(LEFT_CTRL, true, 100, (1, 2), LEFT_CTRL, false));
        assert!(!tap.key(LEFT_CTRL, false, 140, (1, 2), LEFT_CTRL, false));
    }

    #[test]
    fn changing_window_revision_key_or_disabling_cancels_the_pair() {
        for (target, configured) in [
            ((2, 1), LEFT_CTRL),
            ((1, 2), LEFT_CTRL),
            (TARGET, RIGHT_CTRL),
            ((0, 1), LEFT_CTRL),
            (TARGET, 0),
        ] {
            let mut tap = DoubleTap::default();
            assert!(!press(&mut tap, 10));
            assert!(!tap.key(LEFT_CTRL, true, 100, target, configured, false));
            assert!(!tap.key(LEFT_CTRL, false, 140, target, configured, false));
        }
    }

    #[test]
    fn unmatched_keyup_is_ignored_and_clock_wrap_is_supported() {
        let mut tap = DoubleTap::default();
        assert!(!event(&mut tap, LEFT_CTRL, false, 5));
        assert!(!press(&mut tap, u32::MAX - 100));
        assert!(press(&mut tap, 10));
    }

    #[test]
    fn a_missed_keyup_cannot_disable_every_future_double_tap() {
        let mut tap = DoubleTap::default();
        assert!(!event(&mut tap, b'C' as u16, true, 10));
        // Keyup can occur on another input desktop or be swallowed by another hook.
        // The OS says the old key is no longer down when Ctrl is next pressed.
        tap.sync_pressed_keys(|_| false);
        assert!(!press(&mut tap, 100));
        assert!(press(&mut tap, 220));
    }

    #[test]
    fn syncing_preserves_keys_that_are_still_physically_held() {
        let mut tap = DoubleTap::default();
        assert!(!event(&mut tap, b'C' as u16, true, 10));
        tap.sync_pressed_keys(|key| key == b'C' as u16);
        assert!(!press(&mut tap, 100));
        assert!(!press(&mut tap, 220));
    }

    #[test]
    fn a_missed_trigger_keyup_does_not_turn_future_presses_into_repeats() {
        let mut tap = DoubleTap::default();
        assert!(!event(&mut tap, LEFT_CTRL, true, 10));
        tap.sync_pressed_keys(|_| false);
        assert!(!press(&mut tap, 100));
        assert!(press(&mut tap, 220));
    }
}
