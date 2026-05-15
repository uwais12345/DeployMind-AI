import sqlite3

conn = sqlite3.connect('deploymind.db')
cur = conn.cursor()

# Get existing columns
cur.execute('PRAGMA table_info(projects)')
proj_cols = [row[1] for row in cur.fetchall()]
print('Current project cols:', proj_cols)

cur.execute('PRAGMA table_info(deployments)')
dep_cols = [row[1] for row in cur.fetchall()]
print('Current deployment cols:', dep_cols)

# Add missing columns to projects
new_proj_cols = [
    ('status', 'VARCHAR(32)'),
    ('raw_ai_analysis', 'TEXT'),
    ('install_command', 'VARCHAR(512)'),
    ('build_command', 'VARCHAR(512)'),
    ('output_directory', 'VARCHAR(512)'),
]
for col, typedef in new_proj_cols:
    if col not in proj_cols:
        try:
            cur.execute(f'ALTER TABLE projects ADD COLUMN {col} {typedef}')
            print(f'Added projects.{col}')
        except Exception as e:
            print(f'Skip projects.{col}: {e}')

# Add missing columns to deployments
new_dep_cols = [
    ('provider_deployment_id', 'VARCHAR(255)'),
]
for col, typedef in new_dep_cols:
    if col not in dep_cols:
        try:
            cur.execute(f'ALTER TABLE deployments ADD COLUMN {col} {typedef}')
            print(f'Added deployments.{col}')
        except Exception as e:
            print(f'Skip deployments.{col}: {e}')

conn.commit()
print('Migration complete.')
conn.close()
