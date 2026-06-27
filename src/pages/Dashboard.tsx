import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Edit3, Zap, Calendar, BookOpen, BarChart3, HelpCircle, LogOut, Bell, User, Settings } from "lucide-react";
import { listCourseDraftsCloudFirst, deleteCourseDraftCloudFirst, type CourseDraft } from "@/lib/courseDrafts";
import { useAuth } from "@/hooks/useAuth";
import { HelpModal } from "@/components/HelpModal";
import contentForgeLogo from "@/assets/contentforge-logo.png";
import { toast } from "sonner";

const SIDEBAR_ITEMS = [
  { id: "courses", label: "My Courses", icon: BookOpen },
  { id: "templates", label: "Templates", icon: BarChart3, disabled: true },
  { id: "assets", label: "Asset Library", icon: BookOpen, disabled: true },
  { id: "analytics", label: "Analytics", icon: BarChart3, disabled: true },
  { id: "help", label: "Help", icon: HelpCircle },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const [courses, setCourses] = useState<CourseDraft[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        setIsLoading(true);
        const drafts = await listCourseDraftsCloudFirst();
        setCourses(drafts);
      } catch (error) {
        console.error("Failed to load courses:", error);
        toast.error("Failed to load courses");
      } finally {
        setIsLoading(false);
      }
    };

    loadCourses();
  }, []);

  const handleNewCourse = () => {
    navigate("/studio");
  };

  const handleEditCourse = (courseId: string) => {
    navigate("/studio", { state: { courseId } });
  };

  const handleSidebarClick = (itemId: string) => {
    if (itemId === "help") {
      setShowHelpModal(true);
    } else if (itemId === "courses") {
      // Already on this page
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (confirm("Are you sure you want to delete this course?")) {
      try {
        await deleteCourseDraftCloudFirst(courseId);
        setCourses(courses.filter(c => c.id !== courseId));
        toast.success("Course deleted");
      } catch (error) {
        toast.error("Failed to delete course");
      }
    }
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableCredits = (profile?.credits_total ?? 0) - (profile?.credits_used ?? 0);
  const totalCreditsUsed = profile?.credits_used ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900">ContentForge</p>
              <p className="text-xs text-slate-500">Professional Creator</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === "courses";
            return (
              <button
                key={item.id}
                onClick={() => !item.disabled && handleSidebarClick(item.id)}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                  isActive
                    ? "bg-teal-50 text-teal-700 border border-teal-200"
                    : item.disabled
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="px-4 py-6 border-t border-slate-200 space-y-2">
          <button
            onClick={handleNewCourse}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            New Course
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Search */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search courses by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-50"
                />
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* Tabs */}
              <div className="flex gap-0 border border-slate-200 rounded-lg">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "dashboard"
                      ? "bg-slate-100 text-slate-900 border-r border-slate-200"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "settings"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Settings
                </button>
              </div>

              {/* Credits */}
              <div className="flex items-center gap-2 bg-teal-50 px-4 py-2 rounded-lg border border-teal-200">
                <Zap className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-semibold text-teal-700">{availableCredits.toLocaleString()} Credits</span>
              </div>

              {/* Upgrade Button */}
              <button className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-all">
                Upgrade
              </button>

              {/* Icons */}
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                <Bell className="w-5 h-5 text-slate-600" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                <User className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 overflow-auto px-8 py-8">
          {activeTab === "dashboard" ? (
            <>
              {/* Page Title */}
              <h1 className="text-3xl font-bold text-slate-900 mb-8">Dashboard</h1>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Total Courses</p>
                  <p className="text-4xl font-bold text-slate-900">{courses.length}</p>
                </div>
                <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Credits Used</p>
                  <p className="text-4xl font-bold text-slate-900">{totalCreditsUsed.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-6 border border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100 shadow-sm">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Available Credits</p>
                  <p className="text-4xl font-bold text-teal-700">{availableCredits.toLocaleString()} PTS</p>
                </div>
              </div>

              {/* Courses Section */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">My Courses</h2>
                  <div className="flex gap-2">
                    <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all">
                      <BarChart3 className="w-5 h-5 text-slate-600" />
                    </button>
                    <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all">
                      <Settings className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-20 bg-white rounded-lg border border-slate-200">
                    <div className="animate-spin w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full"></div>
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                      <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                    <p className="text-slate-900 font-semibold text-lg mb-2">No courses yet</p>
                    <p className="text-slate-600 mb-6">Ready to transform your ideas into world-class learning modules? Create your first AI-powered course in minutes.</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleNewCourse}
                        className="px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center gap-2"
                      >
                        <Zap className="w-5 h-5" />
                        Create New Course
                      </button>
                      <button className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-all flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        View Tutorial
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        onEdit={() => handleEditCourse(course.id)}
                        onDelete={() => handleDeleteCourse(course.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-600">Settings coming soon...</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={handleNewCourse}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 transition-all flex items-center justify-center"
        title="Create new course"
      >
        <Zap className="w-6 h-6" />
      </button>

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
};

interface CourseCardProps {
  course: CourseDraft;
  onEdit: () => void;
  onDelete: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onEdit, onDelete }) => {
  const hasOutput = course.outputData && Object.values(course.outputData).some(v => v);
  const learningType = course.courseParams?.learningType || "static";
  const contentType = course.courseParams?.contentType || "learning-course";
  const level = course.courseParams?.level || "intermediate";

  const getLearningTypeLabel = (type: string) => {
    switch (type) {
      case "video": return "Video Course";
      case "image": return "Image-Based";
      default: return "E-Learning";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "basic": return "bg-emerald-100 text-emerald-700";
      case "intermediate": return "bg-blue-100 text-blue-700";
      case "advanced": return "bg-purple-100 text-purple-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-teal-300 hover:shadow-md transition-all group">
      {/* Header */}
      <div className="h-24 bg-gradient-to-r from-blue-400 to-blue-500"></div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-3 truncate group-hover:text-teal-700 transition-colors">
          {course.title || "Untitled Course"}
        </h3>

        {/* Tags */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getLevelColor(level)} capitalize`}>
            {level}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {getLearningTypeLabel(learningType)}
          </span>
          {hasOutput && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              ✓ Generated
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-2 mb-6 text-sm border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Created
            </span>
            <span className="text-slate-900 font-medium">{formatDate(course.savedAt)}</span>
          </div>
          {course.courseParams?.duration && (
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Duration
              </span>
              <span className="text-slate-900 font-medium">{course.courseParams.duration}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition-all flex items-center justify-center gap-2 text-sm border border-blue-200"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2.5 rounded-lg hover:bg-red-50 transition-all border border-slate-200 hover:border-red-200"
            title="Delete course"
          >
            <Trash2 className="w-4 h-4 text-slate-600 hover:text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
