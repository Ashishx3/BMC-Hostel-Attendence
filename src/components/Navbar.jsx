export default function Navbar() {
  return (
    <nav className="navbar">

      <div className="nav-brand">

        <div className="brand-icon">
          H
        </div>

        <div>
          <h2>
            HostelTrack
          </h2>

          <span>
            Daily Attendance
          </span>
        </div>

      </div>

      <div className="nav-right">

        <div className="live-dot" />

        <span>
          Hostel Attendance
        </span>

      </div>

    </nav>
  );
}