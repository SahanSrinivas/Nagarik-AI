# Alembic migrations

```bash
# from apps/api/ with venv active and DATABASE_URL set
alembic upgrade head        # apply all migrations
alembic revision -m "..."   # create a new migration
alembic downgrade -1        # roll back one step
alembic history             # show migration tree
```

The initial migration `0001_initial.py` creates PostGIS + pgvector + pg_trgm
extensions and all 5 tables (citizens, crews, issues, verifications, agent_events).
