# Vysti Marker API (Unified)

Educational writing analysis platform with Python backend and React frontend.

## Project Structure

- **Backend**: FastAPI server ([vysti_api.py](vysti_api.py)) + marker engine ([marker.py](marker.py))
- **Frontend**: React + Vite app in [student-react/](student-react/)
- **Legacy UI**: HTML files (index.html, student.html, classes.html, etc.)
- **Assets**: Shared resources in [assets/](assets/) and [shared/](shared/)

## Running the Application

### **Recommended: Docker (easiest for local development)**
```bash
# First time: build and start
docker-compose up --build

# Daily: just start
docker-compose up

# Access at: http://localhost:8000/student_react.html
# Stop: Ctrl+C or `docker-compose down`
```

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for complete Docker instructions.

### Alternative: Native Python (requires manual dependency setup)

#### Backend (Python/FastAPI)
```bash
# Activate virtual environment
source venv311/bin/activate

# Start API server
uvicorn vysti_api:app --host 0.0.0.0 --port 8000

# Or with reload for development
uvicorn vysti_api:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend (React)
```bash
cd student-react
npm run dev          # Development server
npm run build        # Production build
npm run watch        # Auto-build on changes
npm run preview      # Preview production build
npm run test:smoke   # Run Playwright tests
```

## Build & Deploy

- **Python Build**: `./build.sh` (validates Python files + installs dependencies)
- **React Deploy**: `./deploy_student_react.sh` (builds and deploys React app)
- **Manual validation**: `python3 validate_python.py`

## Dependencies

- **Python**: FastAPI, uvicorn, spacy, python-docx, pandas, openpyxl, httpx
- **Node**: React 19, Vite, Playwright (see [student-react/package.json](student-react/package.json))

## Key Files

### Backend
- [vysti_api.py](vysti_api.py) - FastAPI server with CORS, auth, and endpoints
- [marker.py](marker.py) - Core text analysis/grading engine
- [requirements.txt](requirements.txt) - Python dependencies

### Frontend
- [student-react/src/](student-react/src/) - React components and application code
- [student-react/vite.config.js](student-react/vite.config.js) - Vite configuration
- [student-react-config.json](student-react-config.json) - React app configuration

### Configuration & Data
- [power_verbs_2025.json](power_verbs_2025.json) - Writing analysis vocabulary
- [thesis_devices.txt](thesis_devices.txt) - Rhetorical devices reference
- [Vysti Rules for Writing.xlsx](Vysti Rules for Writing.xlsx) - Writing guidelines

## Notes

- Backend runs on port 8000 by default
- React dev server runs on port 5173 (Vite default)
- API has lazy-loading engine to handle slow spaCy model loading
- Use Python 3.11+ (see [.python-version](.python-version))
