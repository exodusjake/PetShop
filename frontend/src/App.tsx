import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { RequireAdmin, RequireAuth } from './components/guards';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/Auth';
import { AccountHome, AccountLayout, SettingsPage, WishlistPage } from './pages/Account';
import { About, NotFound } from './pages/Misc';
import { AddressesPage, PetsPage } from './pages/AccountExtra';
import { AdoptionDetail, AdoptionList, ApplicationsPage } from './pages/Adoption';
import { BlogList, BlogPostPage } from './pages/Blog';
import Contact from './pages/Contact';
import { Privacy, Terms } from './pages/Legal';
// the admin area (and its charts library) loads only when an admin opens it
const AdoptionAdmin = lazy(() => import('./pages/admin/AdoptionAdmin'));
const BlogAdmin = lazy(() => import('./pages/admin/BlogAdmin'));
const ReviewsAdmin = lazy(() => import('./pages/admin/EngagementAdmin').then((m) => ({ default: m.ReviewsAdmin })));
const PromotionsAdmin = lazy(() => import('./pages/admin/EngagementAdmin').then((m) => ({ default: m.PromotionsAdmin })));
const MessagesAdmin = lazy(() => import('./pages/admin/EngagementAdmin').then((m) => ({ default: m.MessagesAdmin })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminCategories = lazy(() => import('./pages/admin/CatalogAdmin').then((m) => ({ default: m.Categories })));
const AdminInventory = lazy(() => import('./pages/admin/CatalogAdmin').then((m) => ({ default: m.Inventory })));
const OrdersAdmin = lazy(() => import('./pages/admin/OrdersAdmin').then((m) => ({ default: m.OrdersAdmin })));
const OrderAdminDetail = lazy(() => import('./pages/admin/OrdersAdmin').then((m) => ({ default: m.OrderAdminDetail })));
const PaymentsAdmin = lazy(() => import('./pages/admin/OrdersAdmin').then((m) => ({ default: m.PaymentsAdmin })));
const AdminCustomers = lazy(() => import('./pages/admin/PeopleReportsSettings').then((m) => ({ default: m.Customers })));
const AdminReports = lazy(() => import('./pages/admin/PeopleReportsSettings').then((m) => ({ default: m.Reports })));
const SettingsAdmin = lazy(() => import('./pages/admin/PeopleReportsSettings').then((m) => ({ default: m.SettingsAdmin })));

const Loading = () => <div className="grid min-h-[40vh] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-peach border-t-primary" role="status" aria-label="Loading" /></div>;
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import { OrderConfirmation, OrderDetailPage, OrdersPage } from './pages/Orders';

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="shop/:productSlug" element={<ProductDetail />} />
        <Route path="categories/:categorySlug" element={<Shop />} />
        <Route path="deals" element={<Shop dealsOnly />} />
        <Route path="about" element={<About />} />
        <Route path="adoption" element={<AdoptionList />} />
        <Route path="adoption/:petId" element={<AdoptionDetail />} />
        <Route path="blog" element={<BlogList />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="contact" element={<Contact />} />
        <Route path="cart" element={<Cart />} />

        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        {/* logged-in customers (and admins) */}
        <Route element={<RequireAuth />}>
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<AccountHome />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="pets" element={<PetsPage />} />
            <Route path="addresses" element={<AddressesPage />} />
            <Route path="adoption-applications" element={<ApplicationsPage />} />
          </Route>
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-confirmation/:orderId" element={<OrderConfirmation />} />
        </Route>


        {/* scheduled for later phases – routes exist so every navigation link resolves */}
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin area: its own layout. This is a UI guard only; every /api/admin route enforces the ADMIN role on the server. */}
      <Route element={<RequireAdmin />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="orders/:orderNumber" element={<OrderAdminDetail />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="payments" element={<PaymentsAdmin />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="adoption" element={<AdoptionAdmin />} />
          <Route path="blog" element={<BlogAdmin />} />
          <Route path="reviews" element={<ReviewsAdmin />} />
          <Route path="promotions" element={<PromotionsAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}
