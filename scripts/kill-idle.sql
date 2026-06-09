SELECT pid, state, age(now(), state_change) AS idle_for, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND age(now(), state_change) > interval '30 seconds';

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND age(now(), state_change) > interval '30 seconds';
