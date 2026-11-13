# SmartGrade

SmartGrade foundation using Next.js, FastAPI, Supabase, and the OpenAI API.

## Prerequisites

- Node.js LTS
- Python 3.12+
- Git
- A Supabase project
- An OpenAI API key

## Database

1. Open the Supabase project dashboard.
2. Open SQL Editor.
3. Run `supabase/migrations/0001_core_schema.sql` in a new, empty project.
4. Configure the private `smartgrade-submissions` Storage bucket and policies using the SQL provided in the project conversation.

## Backend

From the repository root:

```powershell
cd backend
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and add your Supabase URL, anon key, service-role key, and OpenAI API key. Keep this file private.

Start the backend:

```powershell
uvicorn app.main:app --reload
```

Verify `http://127.0.0.1:8000/health` and `http://127.0.0.1:8000/docs`.

The authenticated profile endpoint is `GET /api/v1/auth/me`. It requires a Supabase access token in the `Authorization: Bearer <token>` header.

## Frontend

From the repository root:

```powershell
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd frontend
npx shadcn@latest init
npm install @supabase/supabase-js @supabase/ssr lucide-react recharts zod
```

Create `frontend/.env.local` with the public Supabase URL and anon key. Never place the service-role key or OpenAI API key in the frontend environment.

## Security

The service-role key is used only by trusted FastAPI code and bypasses RLS. It must never be exposed to the browser. The backend validates each Supabase access token before loading the corresponding SmartGrade profile.
