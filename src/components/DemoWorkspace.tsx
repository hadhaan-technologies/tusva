import { useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { Profile, Role } from "../lib/types";
import BrandLogo from "./BrandLogo";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "./ui";

type Section =
  | "overview"
  | "examinations"
  | "results"
  | "questions"
  | "accounts"
  | "academics"
  | "reports";
type Props = { profile: Profile; onSignOut: () => void };
const menu: Record<
  Role,
  { id: Section; label: string; icon: typeof LayoutDashboard }[]
> = {
  student: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "examinations", label: "My examinations", icon: CalendarDays },
    { id: "results", label: "Results", icon: FileCheck2 },
  ],
  faculty: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "questions", label: "Question bank", icon: BookOpen },
    { id: "examinations", label: "Examinations", icon: CalendarDays },
    { id: "results", label: "Results & review", icon: FileCheck2 },
  ],
  admin: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "accounts", label: "Accounts", icon: Users },
    { id: "academics", label: "Academic setup", icon: GraduationCap },
    { id: "reports", label: "Reports & audit", icon: Activity },
  ],
};
const roleTitle: Record<Role, string> = {
  student: "Student workspace",
  faculty: "Faculty workspace",
  admin: "Administration",
};
const fullNavLabels: Record<Section, string> = {
  overview: "Overview",
  examinations: "Examinations",
  results: "Results",
  questions: "Question bank",
  accounts: "Accounts",
  academics: "Academic setup",
  reports: "Reports & audit",
};

export default function DemoWorkspace({ profile, onSignOut }: Props) {
  const [section, setSection] = useState<Section>("overview");
  const [notice, setNotice] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [query, setQuery] = useState("");
  const [extraStudent, setExtraStudent] = useState("");
  const nav = menu[profile.role];
  const displayName = profile.full_name.split(" ")[0];
  const choose = (next: Section) => {
    setSection(next);
    setNotice("");
  };

  return (
    <main className="dash-shell demo-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <BrandLogo className="brand-symbol" />
          <span className="brand-word">TUSVA</span>
        </div>
        <div className="campus-switch">
          <span className="campus-monogram">TC</span>
          <span>
            <b>TUSVA College</b>
            <small>Academic year 2026–27</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <span className="side-caption">WORKSPACE</span>
        <nav className="dash-nav">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? "selected" : ""}
              onClick={() => choose(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "accounts" && profile.role === "admin" && (
                <i className="nav-count">2</i>
              )}
            </button>
          ))}
        </nav>
        {profile.role === "admin" && (
          <>
            <span className="side-caption side-caption-spaced">
              INSTITUTION
            </span>
            <button
              className="sidebar-single"
              onClick={() => choose("academics")}
            >
              <Settings2 size={17} />
              <span>Settings</span>
            </button>
          </>
        )}
        <div className="sidebar-support">
          <span className="support-icon">
            <CircleHelp size={16} />
          </span>
          <span>
            <b>Need a hand?</b>
            <small>Contact the examination office</small>
          </span>
          <ChevronRight size={14} />
        </div>
        <div className="sidebar-account">
          <div className="profile-avatar">{initials(profile.full_name)}</div>
          <span className="account-name">
            <b>{profile.full_name}</b>
            <small>{roleTitle[profile.role]}</small>
          </span>
          <button onClick={onSignOut} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <section className="dash-main">
        <header className="dash-topbar">
          <div className="mobile-brand">
            <BrandLogo className="brand-symbol" />
            <b>TUSVA</b>
          </div>
          <div className="crumbs">
            <span>Campus</span>
            <ChevronRight size={13} />
            <b>{fullNavLabels[section]}</b>
            <Badge className="demo-badge">DEMO</Badge>
          </div>
          <div className="topbar-tools">
            <div className="search-top">
              <Search size={15} />
              <input
                aria-label="Search"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>
            <button className="icon-button" aria-label="Notifications" onClick={() => setNotice('You are all caught up.')}>
              <Bell size={17} />
              <i />
            </button>
            <button
              className="top-profile"
              onClick={() =>
                setNotice(
                  `Signed in as ${profile.institutional_email} in the demo environment.`,
                )
              }
            >
              <span>{initials(profile.full_name)}</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <div className="dash-content">
          <div className="dash-page-heading">
            <div>
              <span className="page-overline">
                {roleTitle[profile.role].toUpperCase()}
              </span>
              <h1>
                {section === "overview"
                  ? `Good morning, ${displayName}`
                  : fullNavLabels[section]}
              </h1>
              <p>{headingDescription(profile.role, section)}</p>
            </div>
            {profile.role === "admin" && section === "accounts" && (
              <Button onClick={() => setShowInvite(true)}>
                <Plus size={16} /> Add account
              </Button>
            )}
            {profile.role === "faculty" && section === "questions" && (
              <Button
                onClick={() =>
                  setNotice(
                    "Demo mode: a new question draft is ready to explore.",
                  )
                }
              >
                <Plus size={16} /> New question
              </Button>
            )}
          </div>
          {notice && (
            <div className="dash-notice" role="status">
              <Check size={16} />
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {section === "overview" && (
            <Overview
              profile={profile}
              onChoose={choose}
              onNotice={setNotice}
            />
          )}
          {section === "examinations" && (
            <ExamSection profile={profile} onNotice={setNotice} />
          )}
          {section === "results" && (
            <ResultsSection role={profile.role} onNotice={setNotice} />
          )}
          {section === "questions" && <QuestionSection onNotice={setNotice} />}
          {section === "accounts" && (
            <AccountsSection
              query={query}
              extraStudent={extraStudent}
              onInvite={() => setShowInvite(true)}
              onNotice={setNotice}
            />
          )}
          {section === "academics" && <AcademicsSection onNotice={setNotice} />}
          {section === "reports" && <ReportsSection onNotice={setNotice} />}
          <footer className="dash-footer">
            <span>
              <ShieldCheck size={14} /> TUSVA College · Secure assessment
              workspace
            </span>
            <span>Demo data · Changes are not saved to your institution</span>
            <span>Product by <a href="https://www.hadhaan.com" target="_blank" rel="noreferrer">Hadhaan Technologies</a></span>
          </footer>
        </div>
      </section>
      {showInvite && (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onSave={(name) => {
            setExtraStudent(name);
            setShowInvite(false);
            setNotice(`${name} added to this browser-only demo.`);
          }}
        />
      )}
      {extraStudent && (
        <span className="sr-only" aria-live="polite">
          {extraStudent} added in the demo.
        </span>
      )}
    </main>
  );
}

function Overview({
  profile,
  onChoose,
  onNotice,
}: {
  profile: Profile;
  onChoose: (s: Section) => void;
  onNotice: (s: string) => void;
}) {
  const faculty = profile.role === "faculty",
    admin = profile.role === "admin";
  const studentStats = [
    ["Assigned exams", "3", "1 this week", "calendar"],
    ["Completed", "8", "Across this semester", "check"],
    ["Average score", "86%", "↑ 4% from last term", "trend"],
    ["Time on task", "12.5h", "This semester", "clock"],
  ];
  const facultyStats = [
    ["Active examinations", "4", "2 close this week", "calendar"],
    ["Question bank", "126", "Across 5 subjects", "book"],
    ["Students reached", "248", "This semester", "users"],
    ["Pending review", "12", "Short answers", "clock"],
  ];
  const adminStats = [
    ["Active students", "1,284", "Across 6 branches", "users"],
    ["Faculty members", "86", "6 departments", "book"],
    ["Examinations", "18", "4 in progress", "calendar"],
    ["Pending requests", "2", "Needs your review", "clock"],
  ];
  const stats = admin ? adminStats : faculty ? facultyStats : studentStats;
  const quick = admin
    ? [
        [
          "accounts",
          "Review account requests",
          "2 registrations waiting for approval",
        ],
        [
          "academics",
          "Manage academic setup",
          "6 branches · 42 active courses",
        ],
      ]
    : faculty
      ? [
          [
            "questions",
            "Build a question",
            "Add text, equations or image options",
          ],
          [
            "examinations",
            "Create an examination",
            "Schedule and assign to a course",
          ],
        ]
      : [
          [
            "examinations",
            "View upcoming exams",
            "Your next assessment is today",
          ],
          ["results", "Check your results", "8 completed assessments"],
        ];
  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="banner-eyebrow">SATURDAY, OCTOBER 10, 2026</span>
          <h2>
            {admin
              ? "A clear view of your campus."
              : faculty
                ? "Your classes, at a glance."
                : "You’re right on track."}
          </h2>
          <p>
            {admin
              ? "Keep your academic community moving with a single overview of access, assessments and activity."
              : faculty
                ? "Pick up where you left off, or see what needs your attention today."
                : "A little preparation goes a long way. Here’s what’s coming up."}
          </p>
        </div>
        <div className="banner-art">
          <div className="banner-art-circle">
            <BookOpenCheck size={31} />
          </div>
          <span className="banner-spark spark-one">✳</span>
          <span className="banner-spark spark-two">✦</span>
        </div>
      </div>
      <div className="stats-row">
        {stats.map(([label, value, caption, icon]) => (
          <MetricCard
            key={label}
            label={label}
            value={value}
            caption={caption}
            icon={icon}
          />
        ))}
      </div>
      <div className="dash-grid-main">
        <Card className="upcoming-card">
          <CardHeader className="split-heading">
            <div>
              <CardTitle>
                {admin
                  ? "Recent campus activity"
                  : faculty
                    ? "Your examinations"
                    : "Coming up next"}
              </CardTitle>
              <CardDescription>
                {admin
                  ? "The latest changes across your institution"
                  : faculty
                    ? "Keep an eye on upcoming schedules"
                    : "Your next scheduled assessment"}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChoose(admin ? "reports" : "examinations")}
            >
              View all <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            {admin ? (
              <ActivityRows />
            ) : faculty ? (
              <FacultyExamRows onNotice={onNotice} />
            ) : (
              <StudentExamRows onNotice={onNotice} />
            )}
          </CardContent>
        </Card>
        <Card className="progress-card">
          <CardHeader>
            <CardTitle>
              {admin
                ? "At a glance"
                : faculty
                  ? "Response overview"
                  : "Your progress"}
            </CardTitle>
            <CardDescription>
              {admin
                ? "Examination activity this term"
                : faculty
                  ? "Student submissions this month"
                  : "Semester 6 · Computer Science"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {admin ? (
              <AdminMiniChart />
            ) : faculty ? (
              <FacultyBars />
            ) : (
              <ProgressChart />
            )}
          </CardContent>
        </Card>
      </div>
      <div className="quick-access">
        <div className="quick-heading">
          <div>
            <CardTitle>Quick access</CardTitle>
            <CardDescription>Useful places to start.</CardDescription>
          </div>
        </div>
        <div className="quick-cards">
          {quick.map(([id, title, desc]) => (
            <button
              className="quick-card"
              key={id}
              onClick={() => onChoose(id as Section)}
            >
              <span className="quick-card-icon">
                {id === "accounts" ? (
                  <Users size={17} />
                ) : id === "questions" ? (
                  <BookOpen size={17} />
                ) : id === "academics" ? (
                  <GraduationCap size={17} />
                ) : id === "results" ? (
                  <FileCheck2 size={17} />
                ) : (
                  <CalendarDays size={17} />
                )}
              </span>
              <b>{title}</b>
              <small>{desc}</small>
              <span className="quick-card-link">
                Open <ArrowRight size={13} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: string;
}) {
  const Icon =
    icon === "calendar"
      ? CalendarDays
      : icon === "check"
        ? Check
        : icon === "trend"
          ? Activity
          : icon === "users"
            ? Users
            : icon === "book"
              ? BookOpen
              : Clock3;
  return (
    <Card className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <i>
          <Icon size={16} />
        </i>
      </div>
      <b className="metric-value">{value}</b>
      <small>{caption}</small>
    </Card>
  );
}

function StudentExamRows({ onNotice }: { onNotice: (s: string) => void }) {
  const rows = [
    ["Signals & Systems", "Today, 10:30 AM", "45 min", "In 2 hours", "ready"],
    [
      "Engineering Mathematics II",
      "Monday, 2:00 PM",
      "60 min",
      "Oct 12",
      "upcoming",
    ],
    [
      "Digital Electronics",
      "Wednesday, 9:00 AM",
      "45 min",
      "Oct 14",
      "upcoming",
    ],
  ];
  return (
    <div className="list-rows">
      {rows.map(([title, when, duration, relative, status], i) => (
        <div className="exam-list-row" key={title}>
          <span className={`row-symbol ${i === 0 ? "green" : ""}`}>
            <BookOpenCheck size={16} />
          </span>
          <span className="row-main">
            <b>{title}</b>
            <small>
              {when} <i>·</i> {duration}
            </small>
          </span>
          <span className={`status-pill ${status}`}>
            {i === 0 ? "Starts soon" : "Scheduled"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`View ${title}`}
            onClick={() =>
              onNotice(
                i === 0
                  ? "Demo exam preview: Signals & Systems · 20 questions · 45 minutes."
                  : "This examination is scheduled for a later date.",
              )
            }
          >
            <ChevronRight size={16} />
          </Button>
          <span className="row-relative">{relative}</span>
        </div>
      ))}
    </div>
  );
}
function FacultyExamRows({ onNotice }: { onNotice: (s: string) => void }) {
  const rows = [
    [
      "Signals & Systems · Midterm",
      "Today, 10:30 AM",
      "64 students",
      "Published",
    ],
    [
      "Engineering Mathematics II",
      "Monday, 2:00 PM",
      "58 students",
      "Scheduled",
    ],
    ["Digital Systems Quiz 3", "Oct 14, 9:00 AM", "61 students", "Draft"],
  ];
  return (
    <div className="list-rows">
      {rows.map(([title, when, students, status]) => (
        <div className="exam-list-row" key={title}>
          <span className="row-symbol">
            <BookOpenCheck size={16} />
          </span>
          <span className="row-main">
            <b>{title}</b>
            <small>
              {when} <i>·</i> {students}
            </small>
          </span>
          <span className={`status-pill ${status.toLowerCase()}`}>
            {status}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Open ${title}`}
            onClick={() =>
              onNotice(
                `${title}: ${students} assigned. Demo exam details opened.`,
              )
            }
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      ))}
    </div>
  );
}
function ActivityRows() {
  const rows = [
    ["Asha Kulkarni", "Student account approved", "8 min ago", "user"],
    [
      "Dr. Meera Nair",
      "Published Signals & Systems Midterm",
      "42 min ago",
      "exam",
    ],
    ["Vikram Hegde", "Student registration received", "1 hr ago", "pending"],
  ];
  return (
    <div className="list-rows">
      {rows.map(([name, description, time, type]) => (
        <div className="activity-row" key={name + time}>
          <span className={`activity-avatar ${type}`}>
            {type === "exam" ? (
              <BookOpenCheck size={15} />
            ) : type === "pending" ? (
              <Clock3 size={15} />
            ) : (
              initials(name)
            )}
          </span>
          <span className="row-main">
            <b>{name}</b>
            <small>{description}</small>
          </span>
          {type === "pending" && (
            <Badge className="pending-badge">Review</Badge>
          )}
          <span className="row-relative">{time}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressChart() {
  return (
    <div className="progress-wrap">
      <div className="progress-score">
        <b>
          86<small>%</small>
        </b>
        <span>Semester average</span>
        <Badge className="positive-badge">↑ 4%</Badge>
      </div>
      <svg
        viewBox="0 0 360 100"
        className="line-chart"
        role="img"
        aria-label="Average score trend increasing over six exams"
      >
        <defs>
          <linearGradient id="fillTrend" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5f9277" stopOpacity=".18" />
            <stop offset="1" stopColor="#5f9277" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,78 C25,72 35,82 60,68 S95,73 120,53 S160,59 180,42 S215,49 240,35 S270,44 295,24 S330,31 360,14 V100 H0Z"
          fill="url(#fillTrend)"
        />
        <path
          d="M0,78 C25,72 35,82 60,68 S95,73 120,53 S160,59 180,42 S215,49 240,35 S270,44 295,24 S330,31 360,14"
          fill="none"
          stroke="#63937a"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="360"
          cy="14"
          r="4"
          fill="#fff"
          stroke="#63937a"
          strokeWidth="2"
        />
      </svg>
      <div className="chart-labels">
        <span>Feb</span>
        <span>Mar</span>
        <span>Apr</span>
        <span>May</span>
        <span>Jun</span>
        <span>Oct</span>
      </div>
      <div className="chart-foot">
        <span>
          <i className="legend-dot" /> Assessment score
        </span>
        <span>Last 6 assessments</span>
      </div>
    </div>
  );
}
function AdminMiniChart() {
  return (
    <div className="admin-chart">
      <div className="chart-legend">
        <span>
          <i /> Published
        </span>
        <span>
          <i /> Draft
        </span>
        <span>
          <i /> Completed
        </span>
      </div>
      <div className="bar-chart">
        {[
          ["May", 44, 24, 32],
          ["Jun", 56, 17, 27],
          ["Jul", 40, 32, 28],
          ["Aug", 66, 14, 20],
          ["Sep", 53, 20, 27],
          ["Oct", 72, 13, 15],
        ].map(([m, a, b, c]) => (
          <div className="bar-col" key={String(m)}>
            <div className="bar-stack">
              <i style={{ height: `${a}%` }} />
              <i style={{ height: `${b}%` }} />
              <i style={{ height: `${c}%` }} />
            </div>
            <small>{m}</small>
          </div>
        ))}
      </div>
      <div className="chart-note">
        <span>18 examinations this term</span>
        <Badge className="positive-badge">↑ 12%</Badge>
      </div>
    </div>
  );
}
function FacultyBars() {
  return (
    <div className="faculty-chart">
      <div className="faculty-chart-summary">
        <b>
          82<span>%</span>
        </b>
        <small>Average completion rate</small>
      </div>
      {[
        ["Signals & Systems", 82],
        ["Math II", 67],
        ["Digital Logic", 91],
        ["Physics", 74],
      ].map(([name, value]) => (
        <div className="faculty-progress" key={String(name)}>
          <span>{name}</span>
          <i>
            <b style={{ width: `${value}%` }} />
          </i>
          <small>{value}%</small>
        </div>
      ))}
    </div>
  );
}

function ExamSection({
  profile,
  onNotice,
}: {
  profile: Profile;
  onNotice: (s: string) => void;
}) {
  const faculty = profile.role === "faculty";
  const rows = faculty
    ? [
        [
          "Signals & Systems · Midterm",
          "Oct 10, 10:30 AM",
          "45 min",
          "Published",
          "64",
        ],
        [
          "Engineering Mathematics II",
          "Oct 12, 2:00 PM",
          "60 min",
          "Scheduled",
          "58",
        ],
        ["Digital Systems Quiz 3", "Oct 14, 9:00 AM", "30 min", "Draft", "61"],
        ["Physics Lab Assessment", "Oct 18, 11:00 AM", "45 min", "Draft", "56"],
      ]
    : [
        ["Signals & Systems", "Oct 10, 10:30 AM", "45 min", "Upcoming", "—"],
        [
          "Engineering Mathematics II",
          "Oct 12, 2:00 PM",
          "60 min",
          "Upcoming",
          "—",
        ],
        ["Digital Electronics", "Oct 14, 9:00 AM", "45 min", "Upcoming", "—"],
        [
          "Engineering Physics",
          "Sep 28, 11:00 AM",
          "30 min",
          "Completed",
          "18/20",
        ],
      ];
  return (
    <Card className="table-card">
      <div className="table-toolbar">
        <div className="filter-search">
          <Search size={15} />
          <input placeholder="Filter examinations" />
        </div>
        <Button variant="outline" size="sm" onClick={() => onNotice('Demo preview: all examination statuses are shown.') }>
          <Filter size={14} /> Filters
        </Button>
      </div>
      <div className="table-scroll">
        <table className="clean-table">
          <thead>
            <tr>
              <th>EXAMINATION</th>
              <th>SCHEDULE</th>
              <th>DURATION</th>
              <th>STATUS</th>
              <th>{faculty ? "ENROLLED" : "RESULT"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(([title, date, duration, status, extra]) => (
              <tr key={title}>
                <td>
                  <b>{title}</b>
                  <small>
                    {faculty
                      ? "Course assessment"
                      : "Course · Computer Science"}
                  </small>
                </td>
                <td>{date}</td>
                <td>{duration}</td>
                <td>
                  <Badge className={`table-status ${status.toLowerCase()}`}>
                    {status}
                  </Badge>
                </td>
                <td>{extra}</td>
                <td>
                  <Button
                    size="sm"
                    variant={faculty ? "ghost" : "outline"}
                    onClick={() =>
                      onNotice(
                        faculty
                          ? `${title}: ${extra} students · ${status}.`
                          : `${title}: exam details are ready to review in this demo.`,
                      )
                    }
                  >
                    {faculty ? "Manage" : "Details"} <ChevronRight size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-bottom">
        <span>Showing 4 examinations</span>
        <span>Page 1 of 1</span>
      </div>
    </Card>
  );
}
function ResultsSection({
  role,
  onNotice,
}: {
  role: Role;
  onNotice: (s: string) => void;
}) {
  const admin = role === "admin",
    faculty = role === "faculty";
  const rows = admin
    ? [
        ["Signals & Systems Midterm", "64", "Oct 10", "Review open"],
        ["Engineering Mathematics II", "58", "Oct 4", "Released"],
        ["Digital Logic Quiz 2", "61", "Oct 2", "Released"],
      ]
    : faculty
      ? [
          ["Signals & Systems · Quiz 2", "64", "Oct 8", "12 to review"],
          ["Digital Logic · Quiz 2", "61", "Oct 2", "Complete"],
          ["Math II · Assignment 1", "58", "Sep 25", "Complete"],
        ]
      : [
          ["Engineering Physics", "20", "Sep 28", "Graded"],
          ["Data Structures", "25", "Sep 20", "Graded"],
          ["Discrete Mathematics", "18", "Sep 15", "Graded"],
        ];
  return (
    <>
      <div className="results-summary">
        {[
          ["Results available", "8"],
          ["Average score", faculty ? "81%" : "86%"],
          ["Awaiting review", faculty ? "12" : "0"],
        ].map(([l, v]) => (
          <Card className="result-mini" key={l}>
            <small>{l}</small>
            <b>{v}</b>
          </Card>
        ))}
      </div>
      <Card className="table-card">
        <div className="table-toolbar">
          <div>
            <CardTitle>
              {admin
                ? "Examination reports"
                : faculty
                  ? "Assessment results"
                  : "Recent results"}
            </CardTitle>
            <CardDescription>
              {admin
                ? "Outcomes across courses and branches"
                : faculty
                  ? "Monitor submission and evaluation status"
                  : "Your latest graded assessments"}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onNotice("A CSV export has been prepared for this demo.")
            }
          >
            <ArrowDownToLine size={14} /> Export CSV
          </Button>
        </div>
        <div className="table-scroll">
          <table className="clean-table">
            <thead>
              <tr>
                <th>ASSESSMENT</th>
                <th>{admin ? "STUDENTS" : "SUBMISSIONS"}</th>
                <th>DATE</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, value, date, status]) => (
                <tr key={name}>
                  <td>
                    <b>{name}</b>
                    <small>
                      {admin
                        ? "Computer Science · Semester 6"
                        : "Course assessment"}
                    </small>
                  </td>
                  <td>{value}</td>
                  <td>{date}</td>
                  <td>
                    <Badge
                      className={`table-status ${status.toLowerCase().includes("review") ? "pending" : "complete"}`}
                    >
                      {status}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onNotice(
                          `${name}: ${value} ${admin ? "students" : "submissions"} · ${status}.`,
                        )
                      }
                    >
                      View <ChevronRight size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function QuestionSection({ onNotice }: { onNotice: (s: string) => void }) {
  const rows = [
    [
      "Kirchhoff’s voltage law",
      "Circuit Theory",
      "Multiple select",
      "Medium",
      "Updated today",
    ],
    [
      "Laplace transform properties",
      "Signals & Systems",
      "Single select",
      "Easy",
      "Updated yesterday",
    ],
    ["Boolean minimization", "Digital Logic", "Image options", "Hard", "Oct 6"],
    [
      "Fourier series expansion",
      "Engineering Mathematics",
      "Numerical",
      "Medium",
      "Oct 3",
    ],
  ];
  return (
    <>
      <div className="library-summary">
        <Card className="library-summary-card">
          <span>
            <BookOpen size={17} />
          </span>
          <b>126</b>
          <small>Questions</small>
        </Card>
        <Card className="library-summary-card">
          <span>
            <GraduationCap size={17} />
          </span>
          <b>5</b>
          <small>Subjects</small>
        </Card>
        <Card className="library-summary-card">
          <span>
            <FileText size={17} />
          </span>
          <b>12</b>
          <small>Used in exams</small>
        </Card>
      </div>
      <Card className="table-card">
        <div className="table-toolbar">
          <div>
            <CardTitle>My question bank</CardTitle>
            <CardDescription>
              Questions are reusable and locked after an exam is published.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onNotice(
                "A new question draft is ready. In live mode, your question bank saves to the institution database.",
              )
            }
          >
            <Plus size={14} /> New question
          </Button>
        </div>
        <div className="table-scroll">
          <table className="clean-table">
            <thead>
              <tr>
                <th>QUESTION</th>
                <th>SUBJECT</th>
                <th>TYPE</th>
                <th>DIFFICULTY</th>
                <th>UPDATED</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(([q, s, t, d, u]) => (
                <tr key={q}>
                  <td>
                    <b>{q}</b>
                    <small>Includes statement preview and solution</small>
                  </td>
                  <td>{s}</td>
                  <td>{t}</td>
                  <td>
                    <Badge className={`difficulty ${d.toLowerCase()}`}>
                      {d}
                    </Badge>
                  </td>
                  <td>{u}</td>
                  <td>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Open ${q}`}
                      onClick={() => onNotice(`${q}: question preview opened.`)}
                    >
                      <ChevronRight size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function AccountsSection({
  query,
  extraStudent,
  onInvite,
  onNotice,
}: {
  query: string;
  extraStudent: string;
  onInvite: () => void;
  onNotice: (s: string) => void;
}) {
  const accounts = [
    [
      "Asha Kulkarni",
      "asha.kulkarni@tusva.edu",
      "Student",
      "4GH23CS014",
      "Active",
    ],
    [
      "Vikram Hegde",
      "vikram.hegde@tusva.edu",
      "Student",
      "4GH24EC028",
      "Pending review",
    ],
    ["Ananya Rao", "ananya.rao@tusva.edu", "Student", "4GH22CS042", "Active"],
    ["Dr. Meera Nair", "meera.nair@tusva.edu", "Faculty", "—", "Active"],
    ["Kiran Shetty", "kiran.shetty@tusva.edu", "Faculty", "—", "Active"],
    ...(extraStudent
      ? [
          [
            extraStudent,
            `${extraStudent.toLowerCase().replace(/\s+/g, ".")}@demo.local`,
            "Student",
            "4GH26CS001",
            "Active",
          ],
        ]
      : []),
  ];
  const filtered = accounts.filter((a) =>
    a.join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="admin-metrics">
        <MetricCard
          label="Total accounts"
          value="1,370"
          caption="All institution users"
          icon="users"
        />
        <MetricCard
          label="Students"
          value="1,284"
          caption="Across 6 branches"
          icon="users"
        />
        <MetricCard
          label="Faculty"
          value="86"
          caption="Across 6 departments"
          icon="book"
        />
        <MetricCard
          label="Pending review"
          value="2"
          caption="New student requests"
          icon="clock"
        />
      </div>
      <Card className="table-card">
        <div className="table-toolbar">
          <div>
            <CardTitle>People and access</CardTitle>
            <CardDescription>
              Review accounts, roles and registration status.
            </CardDescription>
          </div>
          <div className="table-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onNotice(
                  "CSV import is available in the live administrator portal.",
                )
              }
            >
              <ArrowDownToLine size={14} /> Import CSV
            </Button>
            <Button size="sm" onClick={onInvite}>
              <Plus size={14} /> Add account
            </Button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="clean-table">
            <thead>
              <tr>
                <th>PERSON</th>
                <th>ROLE</th>
                <th>USN</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(([name, email, role, usn, status]) => (
                <tr key={email}>
                  <td>
                    <div className="person-cell">
                      <span className="person-avatar">{initials(name)}</span>
                      <span>
                        <b>{name}</b>
                        <small>{email}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <Badge className="role-badge">{role}</Badge>
                  </td>
                  <td>{usn}</td>
                  <td>
                    <Badge
                      className={`table-status ${status === "Active" ? "complete" : "pending"}`}
                    >
                      {status}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onNotice(`${name} account details opened.`)
                      }
                    >
                      Manage <ChevronRight size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-bottom">
          <span>Showing {filtered.length} of 1,370 accounts</span>
          <span>Updated just now · Demo data</span>
        </div>
      </Card>
    </>
  );
}

function AcademicsSection({ onNotice }: { onNotice: (s: string) => void }) {
  return (
    <div className="academic-layout">
      <Card className="table-card">
        <div className="table-toolbar">
          <div>
            <CardTitle>Branches</CardTitle>
            <CardDescription>
              Academic units across the institution.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onNotice("Branch creation is preview-only in this demo.")
            }
          >
            <Plus size={14} /> Add branch
          </Button>
        </div>
        <div className="academic-branch-list">
          {[
            [
              "Computer Science & Engineering",
              "CSE",
              "342 students",
              "24 faculty",
            ],
            [
              "Electronics & Communication",
              "ECE",
              "286 students",
              "18 faculty",
            ],
            ["Mechanical Engineering", "ME", "214 students", "14 faculty"],
            ["Information Science", "ISE", "198 students", "13 faculty"],
            ["Electrical Engineering", "EEE", "142 students", "9 faculty"],
            ["Civil Engineering", "CE", "102 students", "8 faculty"],
          ].map(([name, code, students, faculty]) => (
            <div className="branch-row" key={code}>
              <span className="branch-code">{code}</span>
              <span>
                <b>{name}</b>
                <small>
                  {students} <i>·</i> {faculty}
                </small>
              </span>
              <Badge className="table-status complete">Active</Badge>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Manage ${name}`}
                onClick={() => onNotice(`${name}: academic details opened.`)}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          ))}
        </div>
      </Card>
      <Card className="academic-side">
        <CardHeader>
          <CardTitle>Current term</CardTitle>
          <CardDescription>Academic year 2026–27</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="term-block">
            <span>SEMESTER</span>
            <b>Odd semester</b>
            <small>August 4 – December 12, 2026</small>
          </div>
          <div className="term-block">
            <span>ACTIVE COURSES</span>
            <b>42 courses</b>
            <small>Across 6 academic branches</small>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              onNotice("Academic year settings opened in this demo.")
            }
          >
            Manage courses <ArrowRight size={14} />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSection({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <div className="report-layout">
      <Card className="table-card">
        <div className="table-toolbar">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Administrative and examination events.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNotice('Demo preview: showing the sample activity period.') }>
            <Filter size={14} /> Last 30 days
          </Button>
        </div>
        <div className="audit-list">
          {[
            [
              "Today, 9:42 AM",
              "Asha Kulkarni",
              "Student account approved",
              "account",
            ],
            [
              "Today, 9:08 AM",
              "Dr. Meera Nair",
              "Examination published: Signals & Systems Midterm",
              "exam",
            ],
            [
              "Today, 8:56 AM",
              "Arjun Menon",
              "Course roster imported · 42 records",
              "import",
            ],
            [
              "Yesterday, 4:18 PM",
              "Dr. Prakash Rao",
              "Results released: Engineering Mathematics II",
              "release",
            ],
            [
              "Yesterday, 1:32 PM",
              "Arjun Menon",
              "Academic year 2026–27 updated",
              "admin",
            ],
          ].map(([time, user, action, type]) => (
            <div className="audit-row" key={time + action}>
              <span className="audit-time">{time}</span>
              <span className={`audit-icon ${type}`}>
                {type === "exam" ? (
                  <BookOpenCheck size={15} />
                ) : type === "release" ? (
                  <FileCheck2 size={15} />
                ) : type === "import" ? (
                  <ArrowDownToLine size={15} />
                ) : (
                  <Users size={15} />
                )}
              </span>
              <span>
                <b>{action}</b>
                <small>by {user}</small>
              </span>
              <Badge className="audit-kind">{type}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <div className="report-side">
        <Card className="report-callout">
          <span className="report-icon">
            <ShieldCheck size={18} />
          </span>
          <CardTitle>Audit trail</CardTitle>
          <CardDescription>
            Important account and examination actions are recorded for
            institutional review.
          </CardDescription>
          <span className="callout-stat">
            <b>1,248</b>
            <small>events this term</small>
          </span>
        </Card>
        <Card className="report-callout">
          <span className="report-icon">
            <FileText size={18} />
          </span>
          <CardTitle>Exam summary</CardTitle>
          <CardDescription>
            18 examinations scheduled this term across 6 branches.
          </CardDescription>
          <span className="callout-stat">
            <b>92%</b>
            <small>submission completion</small>
          </span>
        </Card>
      </div>
    </div>
  );
}

function InviteDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card
        className="invite-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
      >
        <div className="dialog-header">
          <span className="dialog-mark">
            <Users size={18} />
          </span>
          <button className="dialog-close" aria-label="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <h2 id="invite-title">Add a student account</h2>
        <p>Send an invitation to join the TUSVA student workspace.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(name.trim() || email.split("@")[0]);
          }}
        >
          <label>Full name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam Patel"
            required
          />
          <label>University email</label>
          <Input
            type="email"
            pattern=".+@jainuniversity\.ac\.in"
            placeholder="name@jainuniversity.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="dialog-role-note">
            <GraduationCap size={16} />
            <span>
              <b>Student access</b>
              <small>
                Faculty and admin access can only be issued by an administrator.
              </small>
            </span>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Add to demo <ArrowRight size={15} />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function headingDescription(role: Role, section: Section) {
  if (section === "overview")
    return role === "admin"
      ? "Your institution’s people, assessments and academic setup, all in one view."
      : role === "faculty"
        ? "A clear picture of your courses, assessments and student progress."
        : "Your assessments and academic progress, all in one place.";
  const values: Record<Section, string> = {
    overview: "",
    examinations:
      role === "student"
        ? "See what is scheduled and review completed assessments."
        : "Create, schedule and monitor course assessments.",
    results: "Review results, status and assessment activity.",
    questions: "Build and organize reusable questions for your assessments.",
    accounts: "Manage student and faculty access across your institution.",
    academics: "Keep branches, courses and semesters up to date.",
    reports: "A clear record of important actions and examination outcomes.",
  };
  return values[section];
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
