"""Runs the slow probes in their own thread, each on its own schedule.

The 10-second loop never waits for them. It just copies in their latest results
with latest(), so a 3-minute `du` can't freeze the dashboard.
"""
import threading
import time


class Background:
    def __init__(self, jobs):
        """jobs: {key: (every_seconds, function)}, e.g. {"smart": (3600, slow.smart)}"""
        self.jobs = jobs
        self.results = {key: None for key in jobs}  # latest value of each job
        self.ran_at = {key: 0 for key in jobs}      # when each last finished (0 = never, so all run at start)
        self.errors = {}
        self.lock = threading.Lock()

    def start(self):
        # daemon=True: the thread dies with the program instead of keeping it alive
        threading.Thread(target=self.loop, daemon=True).start()

    def loop(self):
        while True:
            self.run_due()
            time.sleep(20)

    def run_due(self):
        """Run every job whose time has come, one after another."""
        for key, (every, fn) in self.jobs.items():
            if time.time() - self.ran_at[key] < every:
                continue
            try:
                value, error = fn(), None
            except Exception as e:  # never let one job kill the thread
                value, error = None, f"{type(e).__name__}: {e}"
            with self.lock:  # the main loop may be reading these at this moment
                self.results[key] = value
                self.ran_at[key] = time.time()
                if error:
                    self.errors[key] = error
                else:
                    self.errors.pop(key, None)

    def latest(self):
        """Copies of (results, ran_at, errors), safe to use while the thread keeps working."""
        with self.lock:
            return dict(self.results), dict(self.ran_at), dict(self.errors)
