# Student Management System — Advanced Edition

A full-stack **CRUD-based web application** , extended with advanced features: **JWT authentication, an analytics dashboard, photo uploads, server-side search/filter/pagination, and CSV export.**

## 1\. Project Overview

A Student Management System where authenticated users can create, view, update, and delete student records, see live analytics on a dashboard, search/filter the student list, and export all data as CSV.

## 2\. Problem Statement

Educational institutions need a simple, secure way to manage student records digitally instead of spreadsheets or paper — with the ability to see enrollment analytics at a glance.

## 3\. Objectives

* Implement full CRUD operations on student records
* Secure the API with token-based (JWT) authentication
* Provide an analytics dashboard (totals, averages, distributions)
* Support photo uploads per student
* Support search, filtering, and pagination
* Allow exporting all records to CSV

## 4\. Technology Stack

|Layer|Technology|
|-|-|
|Frontend|HTML, CSS, JavaScript (vanilla, no build step) + Chart.js|
|Backend|Django REST Framework|
|Auth|djangorestframework-simplejwt (JWT access + refresh tokens)|
|Database|SQLite|
|Image handling|Pillow|
|API Testing|curl / Postman / DRF browsable API|

## 5\. System Architecture

```
Browser (HTML/CSS/JS + Chart.js)
        |  fetch() with JWT Bearer token
        v
Django REST Framework API  (/api/...)
        |  ORM
        v
SQLite Database
```

## 6\. Database / ER Design

**Student**

|Field|Type|Constraints|
|-|-|-|
|id|Integer|Primary key, auto|
|name|CharField(100)|required|
|email|EmailField|unique, required|
|phone|CharField(15)|required, 10-15 digits|
|course|CharField(100)|required|
|year|Integer|1-5|
|marks|Float|0-100|
|photo|ImageField|optional|
|created\_at / updated\_at|DateTime|auto|

**User** (Django's built-in auth user) — used for login/registration.

## 7\. Features

### Core CRUD

* Create, list, retrieve, update (PUT/PATCH), delete students
* Client-side **and** server-side validation (required fields, email format, phone digits, marks range, unique email)

### Advanced additions

1. **JWT Authentication** — `/api/auth/register/`, `/api/auth/login/`, `/api/auth/refresh/`. All `/api/students/...` endpoints require a valid access token; the frontend auto-refreshes an expired token using the refresh token.
2. **Dashboard** — `/api/students/stats/` returns total students, average marks, top scorer, course-wise and year-wise distribution. Rendered as bar + doughnut charts (Chart.js) on the frontend.
3. **Search, filter \& pagination** — `?search=<text>` (matches name/email/course), `?course=<text>`, `?year=<n>`, paginated 8 per page with Next/Prev controls.
4. **Photo upload** — multipart form upload, stored under `media/student\_photos/`, shown as a thumbnail in the table.
5. **CSV export** — `/api/students/export/` streams a downloadable CSV of all records.

## 8\. REST API Reference

|Operation|Method|Endpoint|Auth required|
|-|-|-|-|
|Register|POST|`/api/auth/register/`|No|
|Login|POST|`/api/auth/login/`|No|
|Refresh token|POST|`/api/auth/refresh/`|No|
|List/Search students|GET|`/api/students/?search=\&course=\&year=\&page=`|Yes|
|Create student|POST|`/api/students/` (multipart for photo)|Yes|
|Retrieve student|GET|`/api/students/{id}/`|Yes|
|Update student|PUT/PATCH|`/api/students/{id}/`|Yes|
|Delete student|DELETE|`/api/students/{id}/`|Yes|
|Dashboard stats|GET|`/api/students/stats/`|Yes|
|Export CSV|GET|`/api/students/export/`|Yes|

Send the JWT as: `Authorization: Bearer <access\_token>`

## 9\. Installation \& Execution

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up the database
python manage.py migrate

# 3. Run the backend
python manage.py runserver 8000
```

Then open `frontend/index.html` directly in a browser (double-click it, or serve it with any static server). Register a new account, log in, and start managing students.

> The frontend expects the backend at `http://127.0.0.1:8000` (set in `frontend/script.js` as `API\_BASE`) — change it if you run the backend elsewhere.

## 10\. Testing Performed

All endpoints were tested end-to-end via curl before submission:

* ✅ Register a new user → 201 Created
* ✅ Login with correct/incorrect credentials → 200 / 400
* ✅ Create student with valid data → 201, appears in list
* ✅ Create student with missing/invalid fields → 400 with field errors
* ✅ Create student with duplicate email → 400 unique constraint error
* ✅ List students (paginated) → 200
* ✅ Search (`?search=`) and filter (`?year=`) → 200, correct subset returned
* ✅ Update student (PATCH) → 200, value changed
* ✅ Delete student → 200, removed from subsequent list
* ✅ Dashboard stats reflect current data → 200
* ✅ CSV export downloads correct rows → 200, `text/csv`
* ✅ Request without JWT token → 401 Unauthorized (confirms endpoints are protected)

## 11\. Challenges \& Solutions

* **Securing the API without breaking the simple frontend flow** — solved with JWT access + refresh tokens and an `authFetch()` wrapper in JavaScript that transparently retries once on a 401 by refreshing the token.
* **File uploads alongside JSON fields** — solved by switching the form submission to `multipart/form-data` (`FormData`) and adding `MultiPartParser`/`FormParser` to the DRF view.
* **CORS between a file:// frontend and the API** — solved with `django-cors-headers` (`CORS\_ALLOW\_ALL\_ORIGINS = True` for development).

## 12\. Future Enhancements

* Role-based permissions (Admin vs read-only Viewer)
* PDF report generation in addition to CSV
* Bulk import from CSV/Excel
* Deploy backend + frontend to a public host (Render/Netlify) for a live demo link

## 13\. Author / Submission

Student Management System — Advanced EditionMini Web Application (CRUD-Based Web Application).

