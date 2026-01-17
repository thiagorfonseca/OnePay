import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { TransactionTypeEnum } from './types';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './src/auth/AuthProvider';
import RequireSystemAdmin from './components/auth/RequireSystemAdmin';
import AdminLayout from './components/admin/AdminLayout';
import ProtectedContentRoute from './components/auth/ProtectedContentRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const TransactionsPage = lazy(() => import('./pages/Transactions'));
const Reconciliation = lazy(() => import('./pages/Reconciliation'));
const Login = lazy(() => import('./pages/Login'));
const BankAccounts = lazy(() => import('./pages/BankAccounts'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));
const CardAnalysis = lazy(() => import('./pages/CardAnalysis'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const AuthReset = lazy(() => import('./pages/AuthReset'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const AccessDenied = lazy(() => import('./pages/AccessDenied'));
const Profile = lazy(() => import('./pages/Profile'));
const ContentsCourses = lazy(() => import('./pages/ContentsCourses'));
const ContentsTrainings = lazy(() => import('./pages/ContentsTrainings'));
const ContentDetail = lazy(() => import('./pages/ContentDetail'));
const AdminContentList = lazy(() => import('./pages/AdminContentList'));
const AdminContentDetail = lazy(() => import('./pages/AdminContentDetail'));
const AdminTeam = lazy(() => import('./pages/AdminTeam'));
const AdminPackages = lazy(() => import('./pages/AdminPackages'));
const AdminProfile = lazy(() => import('./pages/AdminProfile'));
const CommercialRanking = lazy(() => import('./pages/CommercialRanking'));
const CommercialRecurrence = lazy(() => import('./pages/CommercialRecurrence'));
const CommercialDashboard = lazy(() => import('./pages/CommercialDashboard'));
const CommercialGeo = lazy(() => import('./pages/CommercialGeo'));
const ClinicAssistant = lazy(() => import('./pages/ClinicAssistant'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<div className="p-8 text-gray-500">Carregando...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/reset" element={<AuthReset />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            <Route path="/" element={
              <ProtectedRoute page="/">
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/incomes" element={
              <ProtectedRoute page="/incomes">
                <TransactionsPage type={TransactionTypeEnum.INCOME} />
              </ProtectedRoute>
            } />

            <Route path="/expenses" element={
              <ProtectedRoute page="/expenses">
                <TransactionsPage type={TransactionTypeEnum.EXPENSE} />
              </ProtectedRoute>
            } />

            <Route path="/reconciliation" element={
              <ProtectedRoute page="/reconciliation">
                <Reconciliation />
              </ProtectedRoute>
            } />

            <Route path="/accounts" element={
              <ProtectedRoute page="/accounts">
                <BankAccounts />
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />

            <Route path="/card-analysis" element={
              <ProtectedRoute page="/card-analysis">
                <CardAnalysis />
              </ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute page="/profile">
                <Profile />
              </ProtectedRoute>
            } />

            <Route path="/contents/courses" element={
              <ProtectedRoute page="/contents/courses">
                <ContentsCourses />
              </ProtectedRoute>
            } />
            <Route path="/contents/trainings" element={
              <ProtectedRoute page="/contents/trainings">
                <ContentsTrainings />
              </ProtectedRoute>
            } />
            <Route path="/contents/:type/:contentId" element={
              <ProtectedContentRoute>
                <ContentDetail />
              </ProtectedContentRoute>
            } />

            {/* Comercial */}
            <Route path="/commercial/dashboard" element={
              <ProtectedRoute page="/commercial/dashboard">
                <CommercialDashboard />
              </ProtectedRoute>
            } />
            <Route path="/commercial/ranking" element={
              <ProtectedRoute page="/commercial/ranking">
                <CommercialRanking />
              </ProtectedRoute>
            } />
            <Route path="/commercial/recurrence" element={
              <ProtectedRoute page="/commercial/recurrence">
                <CommercialRecurrence />
              </ProtectedRoute>
            } />
            <Route path="/commercial/geo" element={
              <ProtectedRoute page="/commercial/geo">
                <CommercialGeo />
              </ProtectedRoute>
            } />
            <Route path="/assistant" element={
              <ProtectedRoute page="/assistant">
                <ClinicAssistant />
              </ProtectedRoute>
            } />

            <Route
              path="/admin"
              element={
                <RequireSystemAdmin>
                  <AdminLayout />
                </RequireSystemAdmin>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Admin initialTab="overview" />} />
              <Route path="clinics" element={<Admin initialTab="clinics" />} />
              <Route path="users" element={<Admin initialTab="users" />} />
              <Route path="team" element={<AdminTeam />} />
              <Route path="packages" element={<AdminPackages />} />
              <Route path="content" element={<AdminContentList />} />
              <Route path="content/:id" element={<AdminContentDetail />} />
              <Route path="profile" element={<AdminProfile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Analytics />
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;
