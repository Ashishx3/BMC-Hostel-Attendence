import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is missing");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  cached.conn = await cached.promise;

  return cached.conn;
}

/* ================= STUDENT SCHEMA ================= */

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
    },

    room: {
      type: Number,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["present", "absent"],
      required: true,
    },

    remark: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  }
);

/* ================= ATTENDANCE SCHEMA ================= */

const attendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
    },

    students: {
      type: [studentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Attendance =
  mongoose.models.Attendance ||
  mongoose.model("Attendance", attendanceSchema);

/* ================================================= */
/*              INDIA TIME FUNCTIONS                 */
/* ================================================= */

function getIndiaDateTime() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",

    year: "numeric",
    month: "2-digit",
    day: "2-digit",

    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",

    hour12: false,
  }).formatToParts(new Date());
}

function getPart(parts, type) {
  return parts.find(
    (part) => part.type === type
  )?.value;
}

/* ================= TODAY ================= */

function getToday() {
  const parts = getIndiaDateTime();

  const year = getPart(parts, "year");
  const month = getPart(parts, "month");
  const day = getPart(parts, "day");

  return `${year}-${month}-${day}`;
}

/* ================= CURRENT TIME ================= */

function getIndiaMinutes() {
  const parts = getIndiaDateTime();

  let hour = Number(
    getPart(parts, "hour")
  );

  const minute = Number(
    getPart(parts, "minute")
  );

  /*
   * Some Intl environments can return
   * 24 for midnight.
   */
  if (hour === 24) {
    hour = 0;
  }

  return hour * 60 + minute;
}

/* ================================================= */
/*              ATTENDANCE TIME                      */
/* ================================================= */

function isAttendanceOpen() {
  const currentMinutes =
    getIndiaMinutes();

  const openMinutes =
    20 * 60 + 30; // 8:30 PM

  const closeMinutes =
    21 * 60 + 30; // 9:30 PM

  return (
    currentMinutes >= openMinutes &&
    currentMinutes < closeMinutes
  );
}

/* ================================================= */
/*                    API                            */
/* ================================================= */

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Content-Type",
    "application/json"
  );

  try {
    await connectDB();

    const today = getToday();

    /* ================= GET ================= */

    if (req.method === "GET") {
      let attendance =
        await Attendance.findOne({
          date: today,
        });

      if (!attendance) {
        attendance =
          await Attendance.create({
            date: today,
            students: [],
          });
      }

      return res.status(200).json({
        success: true,

        date: today,

        open: isAttendanceOpen(),

        students:
          attendance.students,
      });
    }

    /* ================= POST ================= */

    if (req.method === "POST") {
      /*
       * SERVER decides whether attendance
       * is open.
       *
       * This uses IST, not Vercel time.
       */

      if (!isAttendanceOpen()) {
        return res.status(403).json({
          success: false,

          message:
            "Attendance is available only between 8:30 PM and 9:30 PM IST.",
        });
      }

      const {
        studentId,
        room,
        name,
        status,
        remark = "",
      } = req.body || {};

      /* ================= VALIDATION ================= */

      if (
        !studentId ||
        !room ||
        !name ||
        !status
      ) {
        return res.status(400).json({
          success: false,

          message:
            "studentId, room, name and status are required.",
        });
      }

      if (
        !["present", "absent"].includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid attendance status.",
        });
      }

      if (
        status === "absent" &&
        !remark.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "A remark is required for absence.",
        });
      }

      /* ================= GET TODAY ================= */

      let attendance =
        await Attendance.findOne({
          date: today,
        });

      if (!attendance) {
        attendance =
          new Attendance({
            date: today,
            students: [],
          });
      }

      /* ================= ALREADY MARKED ================= */

      const alreadyMarked =
        attendance.students.some(
          (student) =>
            student.studentId ===
            studentId
        );

      if (alreadyMarked) {
        return res.status(409).json({
          success: false,

          message:
            "This student's attendance is already marked.",
        });
      }

      /* ================= SAVE ================= */

      attendance.students.push({
        studentId,
        room,
        name,
        status,

        remark:
          status === "absent"
            ? remark.trim()
            : "",
      });

      await attendance.save();

      return res.status(200).json({
        success: true,

        message:
          "Attendance saved successfully.",
      });
    }

    /* ================= OTHER METHODS ================= */

    return res.status(405).json({
      success: false,

      message:
        "Method not allowed.",
    });

  } catch (error) {
    console.error(
      "API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Internal server error.",
    });
  }
}