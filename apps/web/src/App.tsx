import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { PublicLayout } from "./layouts/PublicLayout";

const AdminLayout = lazy(() => import("./admin/AdminLayout"));

export default function App() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
                Loading admin...
              </div>
            }
          >
            <AdminLayout />
          </Suspense>
        }
      />
      <Route path="/*" element={<PublicLayout />} />
    </Routes>
  );
}
