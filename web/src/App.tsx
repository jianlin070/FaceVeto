import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import Toasts from './components/Toasts'
import { RequireAdmin, RequireUser } from './components/Guards'
import AppShell from './components/AppShell'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'
import Feed from './pages/Feed'
import Admin from './pages/Admin'
import AdminCasePage from './pages/AdminCase'
import AdminShell from './components/AdminShell'
import Enrol from './pages/Enrol'
import Protection from './pages/Protection'
import Alerts from './pages/Alerts'
import Profile from './pages/Profile'
import Demo, { DemoGo } from './pages/Demo'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toasts />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/demo/go/:who" element={<DemoGo />} />
          <Route element={<RequireUser />}>
            <Route element={<AppShell />}>
              <Route path="/feed" element={<Feed />} />
              <Route path="/enrol" element={<Enrol />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings/protection" element={<Protection />} />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route element={<AdminShell />}>
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/cases/:id" element={<AdminCasePage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
