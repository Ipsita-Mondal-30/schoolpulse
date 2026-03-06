# SchoolPuls — Full Strategic Plan
### Version 1.0 | March 2026
#### *Built for schools. Loved by parents. Scaled for the nation.*

> **🔗 Live Resources**
> - 📱 **Live App:** [www.schoolpuls.in](https://www.schoolpuls.in/)
> - 🎯 **Product Showcase:** [www.schoolpuls.in/showcase.html](https://www.schoolpuls.in/showcase.html)

## 🎯 Executive Summary

**SchoolPuls** is a parent-school engagement platform that digitises school communication and academic tracking, beginning with daily schedule sharing and expanding into a comprehensive school management ecosystem. The platform is designed for the **Indian K-12 education market**, starting with early years (PP1–Grade 1) and scaling to full-school coverage.

We are building the **"Pulse"** of every school — a real-time digital heartbeat for every student's academic journey.

---

## 🏫 PART 1: PRODUCT VISION

### Current State (MVP — Live Today)
- Daily timetable display for the current school day
- Weekly schedule view
- Homework tracker with share-to-WhatsApp functionality
- Month overview & important dates calendar
- Rhymes and story of the month
- Multi-week navigation with weekend revision content
- AI-generated parent recap activities
- Native share with branded SchoolPuls attribution

---

### 📦 Phase 2: Extended Feature Roadmap

#### 1. Admin / School Coordinator Portal
**Purpose:** Allow school coordinators and class teachers to directly update academic content — reducing dependency on developers for content updates.

**Features:**
- **Content Dashboard** — A clean web interface for teachers to:
  - Upload and manage daily schedules week by week
  - Add/edit homework assignments with due dates and subject tags
  - Publish important dates, holidays, and school events
  - Write and publish the monthly story and rhymes
  - Flag urgent notifications (e.g., "School closed tomorrow")
- **Bulk Import** — Upload weekly schedule via Excel/CSV
- **Preview Mode** — Teachers can see exactly how content will appear to parents before publishing
- **Role Management** — Principal, Admin, Class Coordinator, Teacher roles with different permissions
- **Audit Log** — Who updated what and when

**Tech Approach:** Extend the existing Next.js app with a `/admin` route featuring form-based content management backed by the existing data architecture.

---

#### 2. Monthly Highlights — School-Wide
**Purpose:** Create a "magazine feel" monthly digest that celebrates school life

**Content Sections:**
- 🏆 **Achievement Wall** — Student of the Month, sports wins, competition results
- 🎨 **Creative Corner** — Featured art, writing, or project showcase
- 📣 **From the Principal's Desk** — Monthly message with photo
- 🌿 **Value of the Month** — Character education focus
- 🎉 **School Events Highlights** — Photos + captions from the past month
- 📊 **Academic Pulse** — Class-level summary of what was covered

---

#### 3. Monthly Highlights — Class Level
**Purpose:** Give parents a personalised view for their child's class

**Content Sections:**
- 📚 **Topics Covered This Month** — Subject-wise summary
- 📝 **Assessment Overview** — Test dates, upcoming dictations
- 🌟 **Class Spotlight** — A highlight from the classroom (project, activity)
- 📖 **Reading List** — Books/stories explored this month
- 🔔 **Upcoming for Next Month** — Preview of what's coming
- 📩 **Teacher's Note** — A personal message from the class teacher

---

#### 4. School Information Hub
**Purpose:** Give parents a trusted, always-accessible reference point about the school

**Sections:**
- 🏛️ **About the School** — Founded, ethos, vision, mission
- 👤 **Founder's Story** — History, inspiration, milestones
- 🖊️ **Principal's Desk** — Bio, philosophy, open message to parents
- 👩‍🏫 **Faculty Directory** — Class teachers with subject expertise
- 🗺️ **Campus Information** — MAP, timing, transport routes
- 📞 **Quick Contacts** — Emergency numbers, admin desk, nurse
- 🌐 **School Social Links** — Instagram, website, YouTube

---

#### 5. Parent Engagement Features
- **Daily Push Notifications** — "Today's schedule is ready!" alerts
- **WhatsApp Bot Integration** — Parents can ask "What's today's homework?" via WhatsApp
- **Attendance Nudge** — "Your child hasn't been marked today" notification
- **Parent Gallery** — Year-end photo album with school moments
- **Feedback Loop** — Anonymous parent feedback on school communication quality

---

## 🏫 PART 2: SCHOOL PITCH STRATEGY

### Target Audience
- **Decision Makers:** Principal, Vice Principal, School Administrator, Management Committee
- **Champions:** IT Coordinator, Class Coordinators, Progressive Teachers
- **End Users:** Parents (2 per child)

---

### School Pitch Narrative

#### Opening Hook (30 seconds)
> *"Every parent has this moment: it's Sunday evening, their child's school bag is half-packed, and they have no idea what's happening at school tomorrow. SchoolPuls fixes that — today."*

#### The Problem
- 70% of Indian parents receive school updates via informal WhatsApp groups run by parent volunteers
- Information is noisy, unstructured, and often incorrect
- Teachers spend significant time re-communicating the same information
- There is no single source of truth for a child's daily academic life

#### The Solution
SchoolPuls is a **white-labelled digital parent engagement platform** that:
- Gives parents a structured, beautiful daily schedule view
- Lets school coordinators publish content in minutes, not hours
- Celebrates the school's unique identity (monthly highlights, principal's desk)
- Works on any phone — no app download required (Progressive Web App)

#### Value Proposition for Schools
| Benefit | Impact |
|---|---|
| Parent satisfaction | Reduces "parent panic" and informal group chaos |
| School branding | Every share carries the school's identity |
| Teacher efficiency | Less time spent on repetitive communication |
| Digital credibility | Schools look modern and tech-forward to new admissions |
| Data ownership | School owns the data, not a third-party messaging group |

#### Pricing Model (School Pitch)
- **Starter:** ₹3,000/month — 1 class, up to 40 parents
- **School:** ₹15,000/month — Up to 10 classes, 400 parents
- **Full Campus:** ₹40,000/month — Unlimited classes, all features

#### Pilot Offer (for early adopters)
> *"We'll set up your school for free for 3 months. You just give us honest feedback."*

---

## 💼 PART 3: MULTI-TENANT ARCHITECTURE PLAN

> **Note: This is the next evolution — not in current scope**

### Vision
SchoolPuls as a **SaaS platform** where any school in India can:
1. Sign up online in 10 minutes
2. Get a branded instance (e.g., `app.schoolpuls.in/dps-whitefield`)
3. Manage their own content, staff, and parents independently

### Architecture Approach
- **Tenant Isolation:** Each school gets its own subdomain and data namespace
- **Shared Infrastructure:** Common auth, notification engine, and AI layer
- **Customisation Layer:** School branding (logo, colors, name) applied at tenant level
- **Class Structure:** Multi-class support within each school (PP1A, PP1B, Grade 2A, etc.)
- **Multi-language:** English, Kannada, Hindi UI toggle for parents

### Key Technical Milestones
1. Introduce a database layer (PostgreSQL or Supabase) replacing static JSON files
2. Build tenant management dashboard for SchoolPuls admins
3. Implement role-based auth (SuperAdmin > School Admin > Teacher > Parent)
4. Create self-onboarding flow for new schools
5. Build billing/subscription engine

---

## 🚀 PART 4: VC FUNDING PLAN

### The Market Opportunity

| Metric | Data |
|---|---|
| Total K-12 schools in India | 1.5 Million+ |
| Private schools (addressable) | ~450,000 |
| Students in private schools | ~120 Million |
| Average parents per student | 2 |
| Total parent TAM | 240 Million users |
| Current digital penetration | < 5% |

**The SAM (Serviceable Addressable Market):** English-medium private schools in Tier 1 and Tier 2 cities = ~80,000 schools

> At ₹15,000/school/month → **₹1,200 Crore Annual Revenue Potential** in the SAM alone.

---

### Investment Thesis

**Why now?**
- Post-COVID, school-parent digital communication has become an expectation, not a luxury
- WhatsApp groups have become unmanageable and legally risky for schools
- Indian parents, especially in metros, now expect app-grade experiences from schools
- The "EdTech for schools, not students" category is massively underserved

**Why SchoolPuls?**
- **Bottom-up adoption:** We start with one class, one coordinator, and grow organically within the school
- **High retention:** Once parents use it daily for their child's schedule, churn is near zero
- **Community network effect:** Every sharing action (WhatsApp, native share) is free marketing
- **AI Layer:** AI-generated parent activity suggestions add premium value parents can't get elsewhere

---

### Funding Ask & Use of Funds

#### Seed Round: ₹2 Crore ($250,000)

| Use of Funds | Allocation | Purpose |
|---|---|---|
| Engineering | 45% | Full-stack developer, AI integration, mobile app |
| Sales & Onboarding | 25% | 2 school relationship managers, onboarding team |
| Product & Design | 15% | UX designer, product manager |
| Operations | 10% | Infrastructure, tools, legal, compliance |
| Marketing | 5% | Content, social, school outreach events |

#### Key Milestones (12 months post-funding)
- Month 3: Admin portal live, 5 paid schools onboarded
- Month 6: Multi-tenant platform MVP, 20 schools
- Month 9: WhatsApp Bot integration, 50 schools
- Month 12: Series A readiness — 100 paying schools, ₹1.5 Crore ARR

---

### Growth Strategy

#### Phase 1: City-by-City Land & Expand (0–12 months)
- Start in Bangalore with 10–15 premium schools
- Use principal/coordinator referral network for virality
- Build case studies with school branding ("How DPS Whitefield transformed parent communication")

#### Phase 2: State Expansion (12–24 months)
- Replicate Bangalore playbook in Pune, Hyderabad, Chennai, Mumbai
- Partner with school associations and CBSE regional councils
- Launch native language support (Kannada first, then Hindi and Tamil)

#### Phase 3: National Platform (24–36 months)
- Launch marketplace for school service providers (books, uniforms, school buses)
- Deep AI personalization per student learning profile
- Launch "SchoolPuls for Teachers" — classroom management tools

---

### Competitive Landscape

| Competitor | Focus | Our Advantage |
|---|---|---|
| ClassDojo | US-focused, student behavior | India-first, academic schedule |
| Parentune | Parent community, not school-specific | School-controlled, branded |
| EduSys / iSchoolConnect | Heavy ERP, expensive | Lightweight, affordable, beautiful |
| WhatsApp Groups | Free but chaotic | Structured, branded, searchable |

**Our Moat:** Simplicity + Beauty + WhatsApp-native sharing + AI parent engagement + Indian pricing

---

### Traction (Current)
- 1 school (Bangalore) — live in production
- ~40 active parent users
- Custom March newsletter parsed and live
- Multiple features shipped (homework tracker, rhymes, share button)
- 0% churn — every parent who used it continues using it

---

## 📋 PART 5: EXECUTION PLAYBOOK

### School Onboarding Journey (7 Days)
| Day | Activity |
|---|---|
| Day 1 | Sales call with Principal / Admin |
| Day 2 | Demo walkthrough with coordinator |
| Day 3 | School logo + branding setup |
| Day 4 | First week's schedule uploaded by coordinator |
| Day 5 | Parent onboarding — QR code distributed in school bag |
| Day 6 | Soft launch with 10 parents for feedback |
| Day 7 | Full launch + WhatsApp announcement |

---

### Content Operations Model
- **School Coordinator** manages all academic content via admin panel
- **SchoolPuls Team** handles tech issues and feature requests
- **AI Layer** auto-generates parent tips and recap suggestions per day
- **School** owns data; SchoolPuls has no access without permission

---

### Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Low coordinator adoption (admin panel) | Extreme simplicity; WhatsApp-based update option |
| Schools prefer free WhatsApp | Highlight risks: legal liability, misinformation, privacy |
| Competition from big players | Speed, personal relationship, Indian school-specific features |
| Data privacy concerns | On-premise option, PDPB compliance plan, no student PII shared |

---

## 🗓️ APPENDIX: PITCH DECK SLIDE OUTLINE

1. **Cover** — SchoolPuls: The Pulse of Every School
2. **The Problem** — Parent anxiety + information chaos
3. **The Solution** — Beautiful, structured, school-branded engagement
4. **Product Demo** — Screenshots / live app walk
5. **Market Size** — TAM/SAM/SOM breakdown
6. **Business Model** — SaaS pricing tiers
7. **Traction** — Current users, school feedback
8. **The Team** — Founder background, vision
9. **Roadmap** — 12/24/36 month milestones
10. **The Ask** — ₹2 Crore seed, use of funds
11. **Vision** — SchoolPuls in every school in India by 2030

---

---

## 📎 RESOURCES

| Resource | Link |
|---|---|
| 📱 Live App | [www.schoolpuls.in](https://www.schoolpuls.in/) |
| 🎯 Product Showcase | [www.schoolpuls.in/showcase.html](https://www.schoolpuls.in/showcase.html) |

---

*SchoolPuls — Making every school day feel less like a mystery.*
