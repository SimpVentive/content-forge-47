import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Edit3, Zap, Calendar, Tag, Sparkles } from "lucide-react";
import { listCourseDraftsCloudFirst, deleteCourseDraftCloudFirst, type CourseDraft } from "@/lib/courseDrafts";
import { useAuth } from "@/hooks/useAuth";
import contentForgeLogo from "@/assets/contentforge-logo.png";
import { toast } from "sonner";

export const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CourseDraft[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="px-8 py-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">ContentForge</h1>
                <p className="text-sm text-slate-400 mt-1">AI-Powered Course Creator</p>
              </div>
            </div>
            <button
              onClick={handleNewCourse}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold hover:from-blue-700 hover:to-blue-600 transition-all flex items-center gap-2 shadow-lg hover:shadow-blue-500/50"
            >
              <Plus className="w-5 h-5" />
              Create New Course
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Total Courses</p>
              <p className="text-2xl font-bold text-white">{courses.length}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Credits Used</p>
              <p className="text-2xl font-bold text-amber-400">{totalCreditsUsed.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/50 border border-blue-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Available Credits</p>
              <p className="text-2xl font-bold text-blue-300">{availableCredits.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-12 max-w-7xl mx-auto">
        {/* Search */}
        <div className="mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search courses by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        {/* Courses Section */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-8">My Courses</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-24 bg-slate-800/40 border border-slate-700 rounded-xl">
              <Sparkles className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 mb-2 text-lg font-semibold">No courses yet</p>
              <p className="text-slate-500 mb-6">Create your first AI-powered course in minutes</p>
              <button
                onClick={handleNewCourse}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all"
              >
                Create Your First Course
              </button>
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
      </div>
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

  const getContentTypeColor = (type: string) => {
    return type === "work-instruction" ? "from-orange-500 to-orange-600" : "from-blue-500 to-blue-600";
  };

  const getLearningTypeLabel = (type: string) => {
    switch (type) {
      case "video": return "🎬 Video";
      case "image": return "🖼️ Image-Based";
      default: return "📚 E-Learning";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "basic": return "bg-emerald-500/20 text-emerald-300";
      case "intermediate": return "bg-blue-500/20 text-blue-300";
      case "advanced": return "bg-purple-500/20 text-purple-300";
      default: return "bg-slate-500/20 text-slate-300";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-all hover:shadow-2xl hover:shadow-blue-500/10 group">
      {/* Header Gradient */}
      <div className={`h-24 bg-gradient-to-r ${getContentTypeColor(contentType)}`}></div>

      {/* Content */}
      <div className="p-6">
        {/* Title */}
        <h3 className="text-lg font-bold text-white mb-4 truncate group-hover:text-blue-300 transition-colors">
          {course.title || "Untitled Course"}
        </h3>

        {/* Tags */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getLevelColor(level)} capitalize`}>
            {level}
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-700 text-slate-300">
            {getLearningTypeLabel(learningType)}
          </span>
          {hasOutput && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500/20 text-green-300">
              ✓ Generated
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-2 mb-6 text-sm border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Created
            </span>
            <span className="text-slate-300 font-medium">{formatDate(course.savedAt)}</span>
          </div>
          {course.courseParams?.duration && (
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Duration
              </span>
              <span className="text-slate-300 font-medium">{course.courseParams.duration}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-red-600/20 hover:text-red-300 transition-all"
            title="Delete course"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
