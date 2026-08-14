# **NOW FULLY AVAILABLE AT https://club-base.app ‼️‼️**

> **One app to rule them all.**

ClubBase is an all-in-one platform that allows schools to manage clubs, organizations, sports teams, and teacher tutorials in one centralized location.

Instead of forcing students to juggle apps like GroupMe, Remind, SportsYou, WhatsApp, email, and school websites, ClubBase provides a single place for communication, calendars, announcements, and club discovery.

This project was originally created as a TSA project and is designed to scale from a single school into an entire district and eventually many schools.

---

## Vision

Many students struggle to participate in extracurricular activities because information is scattered across multiple platforms.

ClubBase solves this by providing:

- 📅 One calendar
- 💬 One communication platform
- 🔍 One club directory
- 🏫 School-specific experiences
- 👨‍🏫 Teacher tutorial information
- ⚽ Sports team communication

Everything students need is available inside one app.

---

# Current MVP (Version 1)

The current version focuses on the minimum features needed to prove the idea before adding advanced functionality.

## Student Features

- Secure account creation
- Email verification
- Join a school using a campus code
- Browse all clubs in the school
- Join public clubs
- View club information
- Personal club dashboard
- Unified calendar showing club meetings

---

## Teacher Features

- Teacher login
- Sponsor assigned clubs
- Manage club meetings
- Post announcements

---

## School Admin Features

- Approve teachers
- Manage clubs
- Rotate campus join code
- Manage campus

---

## ClubBase Owner Features

- Create schools
- Approve school administrators
- Manage campuses

---

# Planned Features

The long-term roadmap includes:

### Clubs

- Public and private clubs
- Student leadership permissions
- Club applications
- Club announcements
- Club chat
- Club file sharing
- Officer management

---

### Sports

- Team-specific pages
- Invite-only team joining
- Practice schedules
- Game calendars
- Team communication

---

### Teachers

- Tutorial schedules
- Temporary tutorial changes
- Tutorial cancellation
- Student "My Teachers" page

---

### School News

Allow club leaders to submit:

- announcements
- articles
- event highlights

that appear inside the app instead of requiring students to visit a separate newspaper website.

---

# Technology Stack

Built with:

- Lovable
- React
- TanStack Start
- Nitro
- TypeScript
- Bun
- Vercel
- Upstash Redis
- Resend Email API

---

# Live Demo

https://extracurricular-central.lovable.app

---

# Running Locally

Clone the repository:

```bash
git clone <repository-url>
cd <repository-name>
```

Create an environment file:

```bash
cp .env.example .env
```

Set your owner email:

```env
CLUBBASE_OWNER_EMAILS=your@email.com
```

Install dependencies:

```bash
bun install --frozen-lockfile
```

Run the development server:

```bash
bun run dev
```

---

# Backend Overview

The backend lives entirely inside `src/server`.

It manages:

- accounts
- schools
- clubs
- memberships
- meetings
- announcements
- authentication
- authorization

Client code never directly controls permissions.

---

# Data Storage

ClubBase stores its database as a single JSON document.

## Local Development

```
.data/clubbase.json
```

## Production

Upstash Redis

The storage layer is implemented in:

```
src/server/storage.ts
```

Delete `.data/clubbase.json` to reset to the populated Frisco High School demo.
The seeded accounts below all use the password `raccoons26`:

| Role         | Email                       |
| ------------ | --------------------------- |
| Student      | `student@demo.clubbase.app` |
| Teacher      | `teacher@demo.clubbase.app` |
| School admin | `admin@demo.clubbase.app`   |

Upgrading an empty version-4 database restores this demo automatically. A
database containing real users or clubs is never replaced with sample data.

---

# Authentication

ClubBase uses secure authentication practices.

### Passwords

- PBKDF2-HMAC-SHA256
- 210,000 iterations
- Random 16-byte salt
- Constant-time verification

Passwords are never stored in plaintext.

---

### Email Verification

Every account must verify their email before gaining access.

Verification codes:

- 6 digits
- expire after 10 minutes
- maximum 5 attempts
- resend limited to once per minute

---

### Sessions

Sessions use:

- 256-bit random tokens
- HttpOnly cookies
- SameSite=Lax
- Secure cookies in production

Only the SHA-256 hash of the session token is stored.

Changing a password revokes all active sessions.

---

### Login Protection

Sign-in attempts are rate limited to:

- **10 failed attempts**
- every **15 minutes**
- per email address

---

# Role Hierarchy

No user can assign themselves elevated permissions.

```
ClubBase Owner
        │
        ▼
School Admin
        │
        ▼
Teacher
        │
        ▼
Student
```

## Student

- Join clubs
- View calendar
- Participate in school activities

---

## Teacher

Approved by a School Admin.

Can:

- sponsor clubs
- manage meetings
- create announcements

---

## School Admin

Approved by a ClubBase Owner.

Can:

- approve teachers
- manage campus
- rotate join code
- manage clubs

---

## ClubBase Owner

Configured through:

```env
CLUBBASE_OWNER_EMAILS
```

Can:

- create schools
- approve administrators
- oversee all campuses

Owner accounts are never stored in the database.

---

# Setting Up the First School

1. Add your email to:

```env
CLUBBASE_OWNER_EMAILS
```

2. Restart the server.

3. Sign up using that email.

4. Visit the Owner Console.

5. A prospective school admin submits a new-school application with the school
   name, district, mascot, colors, and verification details.

6. Approve the application from the Owner Console. Approval creates a separate
   campus and unique join code; applicants can never claim an existing campus.

7. The approved admin shares the code with students and staff, approves teacher
   accounts, and manages only their own campus.

To add multiple ClubBase approvers, separate their addresses with commas:

```env
CLUBBASE_OWNER_EMAILS=owner1@district.org,owner2@district.org
```

---

# Deployment

ClubBase runs on **Vercel** or **Netlify**. `vite.config.ts` picks the matching
Nitro preset from the variable the host sets during its build, so no manual
switch is needed — but a build made for the wrong host deploys as static files
with no server behind it, and every route 404s.

Required environment variables on either host:

```
UPSTASH_REDIS_REST_URL

UPSTASH_REDIS_REST_TOKEN

CLUBBASE_OWNER_EMAILS

RESEND_API_KEY

CLUBBASE_FROM_EMAIL
```

Optional:

```
CLUBBASE_REDIS_KEY
```

Upstash Redis is not optional in production. Serverless functions get a
read-only disk and are recycled between requests, so the local file driver has
nowhere to write; the server refuses to start without Redis rather than lose
accounts silently. Set `CLUBBASE_DATA_FILE` to opt back into file storage only
when deploying to a real server with a persistent disk.

## Netlify

`netlify.toml` is committed with the build command and publish directory, so
connecting the repository is enough. The build writes the static site to
`dist/` and the SSR handler to `.netlify/functions-internal/server/`, which
Netlify picks up automatically.

Add the environment variables above under **Site configuration → Environment
variables** before the first deploy — a deployment missing them builds fine and
then fails at request time.

---

# Future Goals

- Mobile applications (iOS & Android)
- District-wide support
- Push notifications
- Club chat
- Event RSVPs
- Attendance tracking
- School branding
- Student leadership permissions
- Newspaper integration
- Sports team management
- Teacher tutorial scheduling
- Analytics dashboard

---

# Project Philosophy

ClubBase aims to become the **Gradeway for extracurricular activities**.

Just as Gradeway centralizes grades and schedules, ClubBase centralizes everything related to student life outside the classroom, making it easier for students to discover opportunities, stay informed, and participate in their school community.
