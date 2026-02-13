import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { TransactionTypeEnum } from './types';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './src/auth/AuthProvider';
import RequireSystemAdmin from './components/auth/RequireSystemAdmin';
import AdminLayout from './components/admin/AdminLayout';
import ProtectedContentRoute from './components/auth/ProtectedContentRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AttendanceReport = lazy(() => import('./pages/AttendanceReport'));
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
const AdminAgenda = lazy(() => import('./pages/AdminAgenda'));
const AdminPackages = lazy(() => import('./pages/AdminPackages'));
const AdminProfile = lazy(() => import('./pages/AdminProfile'));
const CommercialRanking = lazy(() => import('./pages/CommercialRanking'));
const CommercialRecurrence = lazy(() => import('./pages/CommercialRecurrence'));
const CommercialDashboard = lazy(() => import('./pages/CommercialDashboard'));
const CommercialGeo = lazy(() => import('./pages/CommercialGeo'));
const ClinicAssistant = lazy(() => import('./pages/ClinicAssistant'));
const PricingCalculator = lazy(() => import('./pages/PricingCalculator'));
const PricingProcedures = lazy(() => import('./pages/PricingProcedures'));
const PricingExpenses = lazy(() => import('./pages/PricingExpenses'));
const PricingFocusMatrix = lazy(() => import('./pages/PricingFocusMatrix'));
const HRDepartments = lazy(() => import('./pages/HRDepartments'));
const HRCollaborators = lazy(() => import('./pages/HRCollaborators'));
const HRFeedback = lazy(() => import('./pages/HRFeedback'));
const HRMeetings = lazy(() => import('./pages/HRMeetings'));
const HRArchetypes = lazy(() => import('./pages/HRArchetypes'));
const HRValues = lazy(() => import('./pages/HRValues'));
const ClinicAgenda = lazy(() => import('./pages/ClinicAgenda'));
const InventoryDashboard = lazy(() => import('./pages/InventoryDashboard'));
const InventoryItems = lazy(() => import('./pages/InventoryItems'));
const InventorySuppliers = lazy(() => import('./pages/InventorySuppliers'));
const InventoryPurchases = lazy(() => import('./pages/InventoryPurchases'));
const InventoryStock = lazy(() => import('./pages/InventoryStock'));
const InventoryMovements = lazy(() => import('./pages/InventoryMovements'));
const InventoryManualIssue = lazy(() => import('./pages/InventoryManualIssue'));
const InventoryAlerts = lazy(() => import('./pages/InventoryAlerts'));
const InventoryInsights = lazy(() => import('./pages/InventoryInsights'));
const InventoryRecipes = lazy(() => import('./pages/InventoryRecipes'));
const InventoryCounts = lazy(() => import('./pages/InventoryCounts'));
const PublicArchetypeFormPage = lazy(() => import('./src/features/archetype/pages/PublicArchetypeFormPage'));
const PublicArchetypeResultPage = lazy(() => import('./src/features/archetype/pages/PublicArchetypeResultPage'));
const AnalyticsArchetypePage = lazy(() => import('./src/features/archetype/pages/AnalyticsArchetypePage'));
const PublicLinksManagementPage = lazy(() => import('./src/features/archetype/pages/PublicLinksManagementPage'));
const AdminODClients = lazy(() => import('./pages/AdminODClients'));
const AdminODClientDetail = lazy(() => import('./pages/AdminODClientDetail'));
const AdminODContracts = lazy(() => import('./pages/AdminODContracts'));
const AdminODContractForm = lazy(() => import('./pages/AdminODContractForm'));
const AdminODProposals = lazy(() => import('./pages/AdminODProposals'));
const AdminODProposalForm = lazy(() => import('./pages/AdminODProposalForm'));
const AdminODProposalDetail = lazy(() => import('./pages/AdminODProposalDetail'));
const PublicProposalForm = lazy(() => import('./pages/PublicProposalForm'));
const PublicSignatureReturn = lazy(() => import('./pages/PublicSignatureReturn'));
const PublicPaymentPage = lazy(() => import('./pages/PublicPaymentPage'));
const PublicPaymentSuccess = lazy(() => import('./pages/PublicPaymentSuccess'));
const PublicPaymentError = lazy(() => import('./pages/PublicPaymentError'));
const OnboardingWelcome = lazy(() => import('./pages/OnboardingWelcome'));

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
            <Route path="/public/perfil/:publicToken" element={<PublicArchetypeFormPage />} />
            <Route path="/public/perfil/:publicToken/resultado" element={<PublicArchetypeResultPage />} />
            <Route path="/cadastro/:token" element={<PublicProposalForm />} />
            <Route path="/assinatura/retorno" element={<PublicSignatureReturn />} />
            <Route path="/pagamento/:token" element={<PublicPaymentPage />} />
            <Route path="/pagamento/sucesso" element={<PublicPaymentSuccess />} />
            <Route path="/pagamento/erro" element={<PublicPaymentError />} />

            <Route path="/" element={
              <ProtectedRoute page="/">
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/reports/attendance" element={
              <ProtectedRoute page="/reports/attendance">
                <AttendanceReport />
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
            <Route path="/settings/perfil-links" element={
              <ProtectedRoute page="/settings/perfil-links">
                <PublicLinksManagementPage />
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
            <Route path="/pricing/calculator" element={
              <ProtectedRoute page="/pricing/calculator">
                <PricingCalculator />
              </ProtectedRoute>
            } />
            <Route path="/pricing/procedures" element={
              <ProtectedRoute page="/pricing/procedures">
                <PricingProcedures />
              </ProtectedRoute>
            } />
            <Route path="/pricing/expenses" element={
              <ProtectedRoute page="/pricing/expenses">
                <PricingExpenses />
              </ProtectedRoute>
            } />
            <Route path="/pricing/focus-matrix" element={
              <ProtectedRoute page="/pricing/focus-matrix">
                <PricingFocusMatrix />
              </ProtectedRoute>
            } />
            <Route path="/hr/departments" element={
              <ProtectedRoute page="/hr/departments">
                <HRDepartments />
              </ProtectedRoute>
            } />
            <Route path="/hr/collaborators" element={
              <ProtectedRoute page="/hr/collaborators">
                <HRCollaborators />
              </ProtectedRoute>
            } />
            <Route path="/hr/feedback" element={
              <ProtectedRoute page="/hr/feedback">
                <HRFeedback />
              </ProtectedRoute>
            } />
            <Route path="/hr/meetings" element={
              <ProtectedRoute page="/hr/meetings">
                <HRMeetings />
              </ProtectedRoute>
            } />
            <Route path="/hr/archetypes" element={
              <ProtectedRoute page="/hr/archetypes">
                <HRArchetypes />
              </ProtectedRoute>
            } />
            <Route path="/analytics/perfil" element={
              <ProtectedRoute page="/analytics/perfil">
                <AnalyticsArchetypePage />
              </ProtectedRoute>
            } />
            <Route path="/hr/values" element={
              <ProtectedRoute page="/hr/values">
                <HRValues />
              </ProtectedRoute>
            } />
            <Route path="/app/agenda" element={
              <ProtectedRoute page="/app/agenda">
                <ClinicAgenda />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque" element={
              <ProtectedRoute page="/app/estoque">
                <InventoryDashboard />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/itens" element={
              <ProtectedRoute page="/app/estoque/itens">
                <InventoryItems />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/fornecedores" element={
              <ProtectedRoute page="/app/estoque/fornecedores">
                <InventorySuppliers />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/compras" element={
              <ProtectedRoute page="/app/estoque/compras">
                <InventoryPurchases />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/estoque" element={
              <ProtectedRoute page="/app/estoque/estoque">
                <InventoryStock />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/movimentacoes" element={
              <ProtectedRoute page="/app/estoque/movimentacoes">
                <InventoryMovements />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/baixa" element={
              <ProtectedRoute page="/app/estoque/baixa">
                <InventoryManualIssue />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/alertas" element={
              <ProtectedRoute page="/app/estoque/alertas">
                <InventoryAlerts />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/insights" element={
              <ProtectedRoute page="/app/estoque/insights">
                <InventoryInsights />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/receitas" element={
              <ProtectedRoute page="/app/estoque/receitas">
                <InventoryRecipes />
              </ProtectedRoute>
            } />
            <Route path="/app/estoque/contagens" element={
              <ProtectedRoute page="/app/estoque/contagens">
                <InventoryCounts />
              </ProtectedRoute>
            } />

            <Route path="/app/onboarding/boas-vindas" element={
              <ProtectedRoute page="/app/onboarding/boas-vindas">
                <OnboardingWelcome />
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
              <Route path="agenda" element={<AdminAgenda />} />
              <Route path="packages" element={<AdminPackages />} />
              <Route path="content" element={<AdminContentList />} />
              <Route path="content/:id" element={<AdminContentDetail />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route path="clientes" element={<AdminODClients />} />
              <Route path="clientes/:id" element={<AdminODClientDetail />} />
              <Route path="contratos" element={<AdminODContracts />} />
              <Route path="contratos/novo" element={<AdminODContractForm />} />
              <Route path="contratos/:id" element={<AdminODContractForm />} />
              <Route path="propostas" element={<AdminODProposals />} />
              <Route path="propostas/nova" element={<AdminODProposalForm />} />
              <Route path="propostas/:id" element={<AdminODProposalDetail />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;
