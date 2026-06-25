import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, BarChart3, Zap } from "lucide-react";
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
    navigate("/new-course");
  };

  const handleEditCourse = (courseId: string) => {
    navigate(`/`, { state: { courseId } });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/50 shadow-sm">
        <div className="px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={contentForgeLogo} alt="ContentForge" className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">ContentForge</h1>
                <p className="text-sm text-slate-600">Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-900">{availableCredits.toLocaleString()} Credits</span>
              </div>
              <button
                onClick={handleNewCourse}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Course
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-12 max-w-7xl mx-auto">
        {/* Credits Section */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">Total Credits Used</p>
            <p className="text-3xl font-bold text-slate-900">{totalCreditsUsed.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">Available Credits</p>
            <p className="text-3xl font-bold text-blue-600">{availableCredits.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">Total Courses</p>
            <p className="text-3xl font-bold text-slate-900">{courses.length}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Courses Grid */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">My Courses</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-600">Loading courses...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No courses yet. Create your first course!</p>
              <button
                onClick={handleNewCourse}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all"
              >
                Create Course
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
  const learningType = course.courseParams?.learningType || "unknown";
  const contentType = course.courseParams?.contentType || "learning-course";
  const level = course.courseParams?.level || "unknown";

  const getLearningTypeLabel = (type: string) => {
    switch (type) {
      case "video": return "Video Course";
      case "image": return "Image-Based";
      default: return "E-Learning";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-24"></div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2 truncate">{course.title || "Untitled Course"}</h3>

        {/* Metadata */}
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Type:</span>
            <span className="font-medium text-slate-900">{contentType === "work-instruction" ? "Work Instruction" : "Learning Course"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Mode:</span>
            <span className="font-medium text-slate-900">{getLearningTypeLabel(learningType)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Level:</span>
            <span className="font-medium text-slate-900 capitalize">{level}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Created:</span>
            <span className="font-medium text-slate-900">{new Date(course.savedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Status:</span>
            <span className={`font-medium ${hasOutput ? "text-green-600" : "text-slate-500"}`}>
              {hasOutput ? "Generated" : "Draft"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-2 rounded-lg bg-blue-100 text-blue-600 font-semibold hover:bg-blue-200 transition-all text-sm"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 px-3 py-2 rounded-lg bg-red-100 text-red-600 font-semibold hover:bg-red-200 transition-all text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
