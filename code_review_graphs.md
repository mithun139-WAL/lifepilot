# LifePilot — Code Review Graphs

---

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client (Browser)"]
        Dashboard["Dashboard"]
        Chat["Chat"]
        Planner["Planner"]
        Insights["Insights"]
        Settings["Settings"]
    end

    subgraph Middleware["🔒 Middleware"]
        Auth["JWT Auth Check"]
        Onboard["Onboarding Check"]
    end

    subgraph API["⚡ API Routes (Next.js)"]
        PlannerAPI["/api/planner<br/>🧠 4-step AI pipeline"]
        ChatAPI["/api/chat<br/>🌊 Edge Streaming"]
        CRUD["REST CRUD<br/>/api/goals, tasks,<br/>habits, chats"]
        InsightsAPI["/api/insights/*<br/>📊 Analytics"]
        SSE["/api/insights/sse<br/>📡 Live Updates"]
    end

    subgraph External["🌐 External Services"]
        Groq["Groq LLM API<br/>qwen3-32b / llama-3.3-70b"]
        GCal["Google Calendar API"]
        Resend["Resend Email"]
    end

    subgraph DB["🗄️ PostgreSQL (Prisma)"]
        Users["Users"]
        Plans["LearningPlans"]
        Tasks["Tasks + Checklists"]
        Habits["Habits + Progress"]
        Chats["Chats + Messages"]
        Moods["Moods"]
    end

    Client --> Middleware --> API
    PlannerAPI --> Groq
    ChatAPI --> Groq
    PlannerAPI --> GCal
    API --> Resend
    API --> DB
    SSE -.->|5s poll| DB
    Insights -.->|EventSource| SSE
```

---

## 📊 Health Scorecard

```mermaid
graph LR
    subgraph Health["Code Health Score: 6.5/10"]
        direction TB
        A["✅ Auth System<br/>Score: 8/10"] 
        B["✅ AI Pipeline<br/>Score: 7/10"]
        C["⚠️ Chat System<br/>Score: 5/10"]
        D["⚠️ Data Layer<br/>Score: 6/10"]
        E["🔴 Security<br/>Score: 4/10"]
        F["⚠️ Performance<br/>Score: 5/10"]
        G["✅ UI/UX<br/>Score: 7/10"]
    end
```

### Detailed Scores

| Category | Score | Key Issues |
|----------|-------|------------|
| **Authentication** | 8/10 | ✅ 3 providers, JWT refresh, onboarding guard. ⚠️ Middleware performance |
| **AI Pipeline** | 7/10 | ✅ 4-step generation, retry logic, JSON extraction. ⚠️ Date parsing bugs (fixed) |
| **Chat System** | 5/10 | ✅ Streaming works, history persisted. 🔴 No context awareness, no actions, XSS risk |
| **Data Layer** | 6/10 | ✅ Prisma + relations work. ⚠️ Dual storage pattern, missing indexes, SSE queries all users |
| **Security** | 4/10 | 🔴 SSE no auth, XSS in chat, no rate limiting, email verification disabled |
| **Performance** | 5/10 | ⚠️ Middleware DB call per request, SSE 5s polling, no query optimization |
| **UI/UX** | 7/10 | ✅ Clean dark theme, glassmorphism, Recharts. ⚠️ Static suggestions, disabled widgets |

---

## 🔄 Request Flow — Plan Generation

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as /api/planner
    participant Groq as Groq LLM
    participant LP as /api/learning-plans
    participant DB as PostgreSQL

    U->>FE: Click "Generate Plan"
    FE->>API: POST { goalId }
    API->>DB: Fetch Goal details
    
    Note over API,Groq: Step 1: Goal Interpretation
    API->>Groq: goalInterpretationPrompt()
    Groq-->>API: { skills, tools, use_cases }
    
    Note over API,Groq: Step 2: Roadmap
    API->>Groq: roadmapPrompt()
    Groq-->>API: { planner: [week1, week2...] }
    
    Note over API,Groq: Step 3: Tasks (per week)
    loop For each week
        API->>Groq: taskGenerationPrompt()
        Groq-->>API: { tasks: [day1, day2...] }
    end
    
    Note over API,Groq: Step 4: Habits
    API->>Groq: habitsPrompt()
    Groq-->>API: { habits: [...] }
    
    API->>LP: POST { planner, task_list, habits_list }
    LP->>DB: Create LearningPlan (JSON)
    LP->>DB: Create Planner records
    LP->>DB: Create Task + Checklist records
    LP->>DB: Create Habit records
    LP-->>API: learningPlan
    API-->>FE: { roadmap, tasks, habits, savedPlan }
    FE->>U: Redirect to /dashboard
```

---

## 🔄 Request Flow — Chat Message

```mermaid
sequenceDiagram
    participant U as User
    participant FE as ChatPage
    participant Chats as /api/chats
    participant Chat as /api/chat (Edge)
    participant Groq as Groq LLM
    participant DB as PostgreSQL

    U->>FE: Type message + Enter
    
    alt No active chat
        FE->>Chats: POST { title }
        Chats->>DB: Create Chat
        Chats-->>FE: { id }
    end
    
    FE->>Chats: POST /[id]/messages { role: user }
    FE->>FE: Optimistic UI update (SWR mutate)
    
    FE->>Chat: POST { messages: [system, user] }
    Chat->>Groq: Stream chat completion
    
    loop Token by token
        Groq-->>Chat: delta.content
        Chat-->>FE: ReadableStream chunk
        FE->>FE: Append to assistant bubble
    end
    
    FE->>Chats: POST /[id]/messages { role: assistant }
    FE->>FE: SWR revalidate
```

---

## 📦 Module Dependency Graph

```mermaid
graph TD
    subgraph Pages["Pages"]
        P1["dashboard"]
        P2["chat"]
        P3["planner"]
        P4["insights"]
        P5["settings"]
        P6["goal"]
    end

    subgraph Components["Components"]
        C1["TaskList"]
        C2["TaskForm"]
        C3["ChatPromptInput"]
        C4["ChatMessages"]
        C5["SmartSuggestion"]
        C6["TodayTimeline"]
        C7["MoodInsight"]
        C8["FocusPanel"]
        C9["Sidebar"]
        C10["GoalPopover"]
    end

    subgraph Context["Context"]
        CTX1["TaskContext"]
        CTX2["HabitContext"]
        CTX3["ChatContext"]
    end

    subgraph Lib["Libraries"]
        L1["auth.ts"]
        L2["prisma.ts"]
        L3["prompts.ts"]
        L4["groqFetch.ts"]
        L5["googleCalendar.ts"]
        L6["email.ts"]
        L7["utils.ts"]
    end

    subgraph APIs["APIs"]
        A1["/api/planner"]
        A2["/api/chat"]
        A3["/api/learning-plans"]
        A4["/api/insights/sse"]
    end

    P1 --> C5 & C6 & C7 & C8
    P2 --> C3 & C4 & CTX3
    P3 --> C1 & C2 & CTX1
    P4 --> A4
    P5 --> C10

    C1 --> CTX1
    C2 --> CTX1
    C9 --> A3

    A1 --> L3 & L4 & A3
    A2 --> L4
    A3 --> L2 & L5
    CTX1 --> A3

    style C5 fill:#ff6b6b,stroke:#333,color:#fff
    style A4 fill:#ff6b6b,stroke:#333,color:#fff
    style C3 fill:#ffd93d,stroke:#333
```

> 🔴 Red = Critical issues &nbsp;&nbsp; 🟡 Yellow = Needs improvement

---

## 🧱 Component Status Matrix

```mermaid
graph LR
    subgraph Working["✅ Working"]
        W1["Dashboard Page"]
        W2["Plan Generation"]
        W3["Task Display"]
        W4["Habit Tracking"]
        W5["Chat Streaming"]
        W6["Mood Logging"]
        W7["Insights Charts"]
        W8["Goal CRUD"]
        W9["Auth (3 providers)"]
        W10["Google Calendar"]
    end

    subgraph Partial["⚠️ Partial"]
        P1["Smart Suggestions<br/>(static data)"]
        P2["Focus Panel<br/>(naive calc)"]
        P3["Chat Context<br/>(no user data)"]
        P4["SSE Updates<br/>(no auth)"]
        P5["Tasks Page<br/>(missing props)"]
    end

    subgraph Disabled["⏸️ Disabled"]
        D1["HabitStats"]
        D2["LifeScoreCard"]
        D3["JournalPreview"]
        D4["UpcomingReminders"]
        D5["ChatHeader"]
        D6["Email Verification"]
    end

    subgraph Missing["❌ Missing"]
        M1["Error Boundaries"]
        M2["Rate Limiting"]
        M3["Mobile Layout"]
        M4["Toast Notifications"]
        M5["Chat Actions"]
        M6["Proactive Coaching"]
    end
```

---

## 🔐 Security Heat Map

```mermaid
graph TD
    subgraph Risk["Risk Level"]
        direction LR
        HIGH["🔴 HIGH"]
        MED["🟡 MEDIUM"]
        LOW["🟢 LOW"]
    end

    subgraph Endpoints["API Endpoints"]
        A["/api/insights/sse<br/>🔴 No auth, all users data"]
        B["/api/chat<br/>🟡 No rate limit"]
        C["/api/planner<br/>🟡 No rate limit<br/>4x LLM calls"]
        D["/api/learning-plans<br/>🟢 Session auth"]
        E["/api/goals<br/>🟢 Session auth"]
        F["ChatMessages<br/>🔴 XSS via innerHTML"]
    end

    HIGH --> A & F
    MED --> B & C
    LOW --> D & E
```

---

## 📈 Database Query Frequency

| Endpoint | Frequency | Records Touched | Risk |
|----------|-----------|----------------|------|
| `/api/insights/sse` | Every 5s per client | ALL tasks + ALL habits + completions | 🔴 **Critical** |
| `/api/user/profile` | Every page navigation (middleware) | 1 user | 🟡 Medium |
| `/api/planner` | Per plan generation | 4-8 Groq calls + cascading inserts | 🟡 Medium |
| `/api/tasks/today` | On dashboard load | Filtered by userId + date | 🟢 Low |
| `/api/mood` | On dashboard load | Filtered by userId | 🟢 Low |

---

## 🗺️ Improvement Roadmap

```mermaid
gantt
    title LifePilot Improvement Roadmap
    dateFormat  YYYY-MM-DD
    
    section Critical Fixes
    Fix SSE auth + filtering          :crit, f1, 2026-05-06, 1d
    Fix Tasks page props              :crit, f2, 2026-05-06, 1d
    Sanitize chat HTML                :crit, f3, 2026-05-06, 1d
    Cache onboarding in JWT           :f4, after f1, 1d
    
    section Chat Integration
    Context-aware system prompt       :c1, 2026-05-08, 2d
    Chat function calling             :c2, after c1, 3d
    Conversation history management   :c3, after c2, 1d
    
    section Data Quality
    Dynamic smart suggestions         :d1, 2026-05-13, 2d
    Migrate to relational-only reads  :d2, after d1, 2d
    Enable disabled widgets           :d3, after d2, 1d
    
    section Polish
    Error boundaries + toasts         :p1, 2026-05-18, 1d
    Mobile responsive layout          :p2, after p1, 3d
    Bundle optimization               :p3, after p2, 1d
```
