import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import Navbar from "./Navbar";
import "./HostelAttendance.css";
const studentNames = [
  "Lav kush gurjar",
  "Comming Soon",
  "Krishna Pachouri",
  "Abhinav Mishra",
  "Piyush Thakur",
  "Vishal ahirwar",
  "Suman katara",
  "Aditya raghuvanshi",
  "ANIKET JATAV",
  "TANUJ LODHI",
  "Tarun mewada",
  "Kasib khan",
  "shravan kumar patel",
  "jitendra senani",
  "Pushpraj singh",
  "Abhijeet ahirwar",
  "Nagraj jamra",
  "Pratik thakur",
  "Mehul baraskar",
  "Vishal kumar prajapati",
  "Manoj Singh",
  "Rajesh Kumar Vishvakarma",
  "Ayush Kumar Kushwaha",
  "Nitin Saini",
  "Vinay rampure murena",
  "Dalsingh Solanki Barwani",
  "Harshit singh",
  "Divyanshu wasuniya",
  "Neeraj Sagar",
  "Comming Soon",
  "vasudev gyarasiya",
  "manish suman",
  "Divesh verma",
  "Umang Gupta",
  "raj bundela",
  "Dayaram jamre",
  "SAURBH BHARTI",
  "ANURAG SAHU",
  "Priyanshu Rathore",
  "Govind Ahirwar",
  "ankit meena",
  "himanshu gupta",
];

const rooms = Array.from({ length: 21 }, (_, roomIndex) => ({
  room: roomIndex + 1,

  students: [
    {
      studentId: `S${roomIndex * 2 + 1}`,
      name: studentNames[roomIndex * 2],
    },
    {
      studentId: `S${roomIndex * 2 + 2}`,
      name: studentNames[roomIndex * 2 + 1],
    },
  ],
}));

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTimeStatus() {
  const now = new Date();

  const currentMinutes =
    now.getHours() * 60 + now.getMinutes();

  const openTime = 20 * 60 + 30;
  const closeTime = 21 * 60 + 30;

  if (currentMinutes < openTime) {
    return "before";
  }

  if (
    currentMinutes >= openTime &&
    currentMinutes < closeTime
  ) {
    return "open";
  }

  return "closed";
}

export default function HostelAttendance() {
  const REPORT_PASSWORD = "bmc@123";
  const [today, setToday] = useState(getToday());

  const [timeStatus, setTimeStatus] =
    useState(getTimeStatus());

  const [currentTime, setCurrentTime] =
    useState(new Date());

  const [attendance, setAttendance] = useState({});

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(null);

  const [error, setError] = useState("");

  const [remarkStudent, setRemarkStudent] =
    useState(null);

  const [remarkText, setRemarkText] =
    useState("");
    const [showReportPassword, setShowReportPassword] = useState(false);
const [reportPassword, setReportPassword] = useState("");
const [reportError, setReportError] = useState("");

  /*
   * All students in one array
   */
  const allStudents = useMemo(() => {
    return rooms.flatMap((room) =>
      room.students.map((student) => ({
        ...student,
        room: room.room,
      }))
    );
  }, []);

  /*
   * Load attendance from MongoDB
   */
  async function loadAttendance() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/attendance");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load attendance."
        );
      }

      const formattedAttendance = {};

      data.students.forEach((student) => {
        formattedAttendance[student.studentId] = {
          status: student.status,
          remark: student.remark || "",
        };
      });

      setAttendance(formattedAttendance);

      setToday(data.date);

      setTimeStatus(
        data.open ? "open" : getTimeStatus()
      );
    } catch (error) {
      console.error(error);

      setError(
        error.message ||
          "Unable to connect to the attendance server."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Load attendance when page opens
   */
  useEffect(() => {
    loadAttendance();
  }, []);

  /*
   * Update clock every second
   */
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();

      setCurrentTime(now);

      const newDate = getToday();

      /*
       * Midnight:
       * refresh attendance for new day
       */
      if (newDate !== today) {
        setToday(newDate);
        setAttendance({});
        loadAttendance();
      }

      setTimeStatus(getTimeStatus());
    }, 1000);

    return () => clearInterval(timer);
  }, [today]);

  /*
   * Mark Present
   */
  async function markPresent(student) {
    if (timeStatus !== "open") {
      return;
    }

    if (attendance[student.studentId]) {
      return;
    }

    await saveAttendance(
      student,
      "present",
      ""
    );
  }

  /*
   * Open absent modal
   */
  function openAbsentModal(student) {
    if (timeStatus !== "open") {
      return;
    }

    if (attendance[student.studentId]) {
      return;
    }

    setRemarkStudent(student);
    setRemarkText("");
  }

  /*
   * Save absent
   */
  async function saveAbsent() {
    if (!remarkStudent) {
      return;
    }

    const remark = remarkText.trim();

    if (!remark) {
      alert(
        "Please enter the reason for absence."
      );

      return;
    }

    await saveAttendance(
      remarkStudent,
      "absent",
      remark
    );

    setRemarkStudent(null);
    setRemarkText("");
  }

  /*
   * Send attendance to MongoDB
   */
  async function saveAttendance(
    student,
    status,
    remark
  ) {
    try {
      setSaving(student.studentId);
      setError("");

      const response = await fetch(
        "/api/attendance",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            studentId: student.studentId,
            room: student.room,
            name: student.name,
            status,
            remark,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
            "Unable to save attendance."
        );

        return;
      }

      /*
       * Update UI immediately
       */
      setAttendance((previous) => ({
        ...previous,

        [student.studentId]: {
          status,
          remark,
        },
      }));
    } catch (error) {
      console.error(error);

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setSaving(null);
    }
  }

  /*
   * Format date
   */
  function formatDate() {
    return currentTime.toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  }

  /*
   * Format time
   */
  function formatTime() {
    return currentTime.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  }

  /*
   * Statistics
   */
  const presentCount = allStudents.filter(
    (student) =>
      attendance[student.studentId]?.status ===
      "present"
  ).length;

  const absentCount = allStudents.filter(
    (student) =>
      attendance[student.studentId]?.status ===
      "absent"
  ).length;

  const markedCount =
    presentCount + absentCount;

  const pendingCount =
    allStudents.length - markedCount;

  /*
   * PDF Report
   */
  const verifyReportPassword = async () => {
  if (reportPassword !== REPORT_PASSWORD) {
    setReportError("Incorrect password.");
    return;
  }

  setShowReportPassword(false);
  setReportPassword("");
  setReportError("");

  await downloadReport();
};
  async function downloadReport() {
  try {
    const response = await fetch("/api/attendance");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to fetch attendance report."
      );
    }

    const latestAttendance = {};

    data.students.forEach((student) => {
      latestAttendance[student.studentId] = {
        status: student.status,
        remark: student.remark || "",
      };
    });

    const doc = new jsPDF();

    const pageWidth =
      doc.internal.pageSize.getWidth();

    doc.setFontSize(22);

    doc.text(
      "Hostel Attendance Report",
      pageWidth / 2,
      20,
      {
        align: "center",
      }
    );

    doc.setFontSize(10);

    doc.text(
      `Date: ${data.date}`,
      20,
      32
    );

    doc.text(
      `Generated: ${formatTime()}`,
      20,
      39
    );

    doc.setDrawColor(200);

    doc.line(
      20,
      44,
      pageWidth - 20,
      44
    );

    const presentCount = allStudents.filter(
      (student) =>
        latestAttendance[
          student.studentId
        ]?.status === "present"
    ).length;

    const absentCount = allStudents.filter(
      (student) =>
        latestAttendance[
          student.studentId
        ]?.status === "absent"
    ).length;

    const pendingCount =
      allStudents.length -
      presentCount -
      absentCount;

    doc.setFontSize(12);

    doc.text(
      `Total Students: ${allStudents.length}`,
      20,
      56
    );

    doc.text(
      `Present: ${presentCount}`,
      20,
      64
    );

    doc.text(
      `Absent: ${absentCount}`,
      20,
      72
    );

    doc.text(
      `Not Marked: ${pendingCount}`,
      20,
      80
    );

    let y = 95;

    doc.setFontSize(9);

    allStudents.forEach(
      (student, index) => {
        const record =
          latestAttendance[
            student.studentId
          ];

        const status =
          record?.status?.toUpperCase() ||
          "NOT MARKED";

        const remark =
          record?.remark || "-";

        const line =
          `${index + 1}. Room ${student.room} | ` +
          `${student.name} | ` +
          `${status} | ` +
          `${remark}`;

        if (y > 280) {
          doc.addPage();
          y = 20;
        }

        const lines =
          doc.splitTextToSize(
            line,
            pageWidth - 30
          );

        doc.text(
          lines,
          15,
          y
        );

        y +=
          lines.length * 5 + 3;
      }
    );

    doc.save(
      `Hostel-Attendance-${data.date}.pdf`
    );

  } catch (error) {
    console.error(error);

    alert(
      "Unable to download the attendance report."
    );
  }
}

  /*
   * Status information
   */
  const statusTitle =
    timeStatus === "open"
      ? "Attendance is Open"
      : timeStatus === "before"
      ? "Attendance Not Started"
      : "Attendance Closed";

  const statusDescription =
    timeStatus === "open"
      ? "You can mark attendance until 9:30 PM."
      : timeStatus === "before"
      ? "Attendance opens at 8:30 PM."
      : "Today's attendance is locked.";

  /*
   * Loading screen
   */
  if (loading) {
    return (
      <div className="attendance-page">
        <Navbar />

        <div className="loading-screen">
          <div className="loader"></div>

          <h2>
            Loading Attendance
          </h2>

          <p>
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-page">

      <Navbar />

      <main className="attendance-container">

        {/* ================= HERO ================= */}

        <section className="hero">

          <div>
            <div className="eyebrow">
              HOSTEL MANAGEMENT
            </div>

            <h1 className="as">
              Evening{" "}
              <span>Attendance</span>
            </h1>

            <p>
              Track today's hostel attendance
              quickly and securely.
            </p>
          </div>

          <div className="date-card">

            <span>
              TODAY
            </span>

            <strong>
              {formatDate()}
            </strong>

            <small>
              {formatTime()}
            </small>

          </div>

        </section>

        {/* ================= ERROR ================= */}

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        {/* ================= STATUS ================= */}

        <section className="status-card">

          <div className="status-left">

            <div
              className={`status-indicator ${
                timeStatus === "open"
                  ? "active"
                  : "inactive"
              }`}
            />

            <div>

              <strong>
                {statusTitle}
              </strong>

              <p>
                {statusDescription}
              </p>

            </div>

          </div>

          <div className="time-window">

            <div>
              <span>
                OPENS
              </span>

              <b>
                8:30 PM
              </b>
            </div>

            <div className="arrow">
              →
            </div>

            <div>
              <span>
                CLOSES
              </span>

              <b>
                9:30 PM
              </b>
            </div>

          </div>

        </section>

        {/* ================= STATS ================= */}

        <section className="stats">

          <div className="stat-card total">

            <span>
              Total Students
            </span>

            <strong>
              {allStudents.length}
            </strong>

          </div>

          <div className="stat-card present">

            <span>
              Present
            </span>

            <strong>
              {presentCount}
            </strong>

          </div>

          <div className="stat-card absent">

            <span>
              Absent
            </span>

            <strong>
              {absentCount}
            </strong>

          </div>

          <div className="stat-card pending">

            <span>
              Not Marked
            </span>

            <strong>
              {pendingCount}
            </strong>

          </div>

        </section>

        {/* ================= ROOMS ================= */}

        <section className="rooms-section">

          <div className="section-header">

            <div>

              <h2>
                Hostel Rooms
              </h2>

              <p>
                21 rooms · 42 students
              </p>

            </div>

           <button
  className="report-button"
  onClick={() => {
    setReportPassword("");
    setReportError("");
    setShowReportPassword(true);
  }}
>
  📄 Download Report
</button>
          </div>

          <div className="rooms">

            {rooms.map((room) => {

              const roomMarked =
                room.students.every(
                  (student) =>
                    attendance[
                      student.studentId
                    ]
                );

              return (
                <div
                  className="room-card"
                  key={room.room}
                >

                  {/* Room Header */}

                  <div className="room-header">

                    <div className="room-number">

                      <span>
                        ROOM
                      </span>

                      <strong>
                        {String(
                          room.room
                        ).padStart(
                          2,
                          "0"
                        )}
                      </strong>

                    </div>

                    <div
                      className={`room-status ${
                        roomMarked
                          ? "completed"
                          : ""
                      }`}
                    >
                      {roomMarked
                        ? "✓ Completed"
                        : "Pending"}
                    </div>

                  </div>

                  {/* Students */}

                  <div className="student-list">

                    {room.students.map(
                      (student) => {

                        const record =
                          attendance[
                            student.studentId
                          ];

                        const isSaving =
                          saving ===
                          student.studentId;

                        return (
                          <div
                            className={`student-row ${
                              record?.status ||
                              ""
                            }`}
                            key={
                              student.studentId
                            }
                          >

                            <div className="student-info">

                              <div className="avatar">
                                {student.name
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </div>

                              <div>

                                <strong>
                                  {
                                    student.name
                                  }
                                </strong>

                                <span>
                                  Student ·
                                  Room{" "}
                                  {
                                    room.room
                                  }
                                </span>

                              </div>

                            </div>

                            <div className="attendance-actions">

                              <button
                                className={`present-btn ${
                                  record?.status ===
                                  "present"
                                    ? "selected"
                                    : ""
                                }`}
                                disabled={
                                  timeStatus !==
                                    "open" ||
                                  !!record ||
                                  isSaving
                                }
                                onClick={() =>
                                  markPresent(
                                    {
                                      ...student,
                                      room:
                                        room.room,
                                    }
                                  )
                                }
                              >

                                {isSaving &&
                                !record ? (
                                  "Saving..."
                                ) : (
                                  <>
                                    ✓ Present
                                  </>
                                )}

                              </button>

                              <button
                                className={`absent-btn ${
                                  record?.status ===
                                  "absent"
                                    ? "selected"
                                    : ""
                                }`}
                                disabled={
                                  timeStatus !==
                                    "open" ||
                                  !!record ||
                                  isSaving
                                }
                                onClick={() =>
                                  openAbsentModal(
                                    {
                                      ...student,
                                      room:
                                        room.room,
                                    }
                                  )
                                }
                              >
                                × Absent
                              </button>

                            </div>

                            {/* Saved remark */}

                            {record?.status ===
                              "absent" && (
                              <div className="saved-remark">

                                <b>
                                  Reason:
                                </b>{" "}

                                {
                                  record.remark
                                }

                              </div>
                            )}

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>
              );
            })}

          </div>

        </section>

      </main>
     {showReportPassword && (
  <div className="password-overlay">
    <div className="password-modal">
      <button
        className="password-close"
        onClick={() => {
          setShowReportPassword(false);
          setReportPassword("");
          setReportError("");
        }}
      >
        ×
      </button>

      <div className="password-icon">🔐</div>

      <h2>Download Report</h2>

      <p>
        Enter the password to download today's attendance report.
      </p>

      <input
        type="password"
        value={reportPassword}
        onChange={(e) => {
          setReportPassword(e.target.value);
          setReportError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            verifyReportPassword();
          }
        }}
        placeholder="Enter password"
        autoFocus
      />

      {reportError && (
        <div className="password-error">
          {reportError}
        </div>
      )}

      <button
        className="password-submit"
        onClick={verifyReportPassword}
      >
        Unlock & Download
      </button>
    </div>
  </div>
)}
      {/* ================= ABSENT MODAL ================= */}

      {remarkStudent && (
        <div className="modal-overlay">

          <div className="remark-modal">

            <button
              className="close-modal"
              onClick={() => {
                setRemarkStudent(
                  null
                );

                setRemarkText("");
              }}
            >
              ×
            </button>

            <div className="modal-icon">
              !
            </div>

            <h2>
              Mark Absent
            </h2>

            <p>
              Enter the reason why{" "}
              <strong>
                {remarkStudent.name}
              </strong>{" "}
              is absent.
            </p>

            <textarea
              value={remarkText}
              onChange={(event) =>
                setRemarkText(
                  event.target.value
                )
              }
              placeholder="Example: Went home for family function..."
              rows={4}
              autoFocus
            />

            <button
              className="save-remark"
              onClick={saveAbsent}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Absence"}
            </button>

          </div>

        </div>
      )}

 

    </div>
  );
}