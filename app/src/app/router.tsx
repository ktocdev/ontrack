import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth, RequireRole, RoleHome } from '../auth/guards'
import { SignInScreen } from '../screens/auth/SignInScreen'
import { NoAccessScreen } from '../screens/errors/NoAccessScreen'
import { NotFoundScreen } from '../screens/errors/NotFoundScreen'
import { RouteErrorScreen, ServerErrorScreen } from '../screens/errors/ServerErrorScreen'
import { LinkExpiredScreen } from '../screens/invite/LinkExpiredScreen'
import { CenteredLoading, CheckingInvite } from '../screens/loading/CenteredLoading'
import { PlaceholderScreen } from '../screens/placeholder/PlaceholderScreen'
import { ContractorLinkScreen } from '../screens/contractors/ContractorLinkScreen'
import { EquipmentLinkScreen } from '../screens/equipment/EquipmentLinkScreen'
import { TicketLinkScreen } from '../screens/tickets/TicketLinkScreen'
import { BareShell, Shell } from './Shell'

/**
 * Routes follow the design's href links. Signed-in routes sit under
 * RequireAuth; each role's area sits under RequireRole and renders inside the
 * Shell with that role's tab bar. Anything unknown is the 404 board.
 * Screens most people rarely open (the kit, Profile, Help) load on demand;
 * later phases do the same per role area so a manager never downloads admin.
 */
const placeholder = (title: string, phase: string, note?: string) => ({
  element: <PlaceholderScreen title={title} phase={phase} note={note} />,
})

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorScreen />,
    // Shown on a cold load of a lazy route while its code arrives.
    hydrateFallbackElement: <CenteredLoading title="Loading…" body="This only takes a moment." />,
    children: [
      // Public
      { path: '/sign-in', element: <BareShell />, children: [{ index: true, element: <SignInScreen /> }] },
      {
        path: '/reset',
        element: <BareShell />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('../screens/reset/ResetRequestScreen')).ResetRequestScreen,
            }),
          },
          {
            path: 'sent',
            lazy: async () => ({ Component: (await import('../screens/reset/ResetSentScreen')).ResetSentScreen }),
          },
          {
            path: 'new',
            lazy: async () => ({ Component: (await import('../screens/reset/ResetNewScreen')).ResetNewScreen }),
          },
          {
            path: 'done',
            lazy: async () => ({ Component: (await import('../screens/reset/ResetDoneScreen')).ResetDoneScreen }),
          },
        ],
      },
      {
        path: '/invite',
        element: <BareShell />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('../screens/invite/SetUpAccountScreen')).SetUpAccountScreen,
            }),
          },
        ],
      },
      {
        path: '/kit',
        element: <BareShell />,
        children: [
          { index: true, lazy: async () => ({ Component: (await import('../screens/kit/KitPage')).KitPage }) },
          { path: 'loading/spinner', element: <CheckingInvite /> },
          {
            path: 'loading/scan',
            element: (
              <CenteredLoading
                title="Finding equipment…"
                body={
                  <>
                    QR code read: <span className="font-mono text-text">EQ-0148</span>
                  </>
                }
                cancelTo="/kit"
              />
            ),
          },
          { path: 'errors/404', element: <NotFoundScreen /> },
          {
            path: 'errors/invite-expired',
            element: <LinkExpiredScreen onRequest={() => undefined} />,
          },
          {
            path: 'errors/reset-expired',
            element: (
              <LinkExpiredScreen
                title="This reset link has expired"
                body="Reset links work for 30 minutes and only once. Your password hasn't changed. Get a fresh link below."
                requestLabel="Email me a new link"
                onRequest={() => undefined}
              />
            ),
          },
          {
            path: 'errors/403',
            element: (
              <NoAccessScreen
                title="You don't have access to this ticket"
                body={
                  <>
                    This ticket is for <b className="text-text">Porter</b>. Your account can see tickets for Federale’s
                    Logan Square only.
                  </>
                }
                backTo="/kit"
                email="maya.reyes@example.com"
                crumb={<span className="font-mono text-13 text-text-secondary">OT-1044</span>}
              />
            ),
          },
          {
            path: 'errors/500',
            element: <ServerErrorScreen error={new Error('Kit preview')} onRetry={() => undefined} />,
          },
        ],
      },

      // Signed in
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <RoleHome /> },
          { path: '/t/:id', element: <BareShell />, children: [{ index: true, element: <TicketLinkScreen /> }] },
          { path: '/e/:id', element: <BareShell />, children: [{ index: true, element: <EquipmentLinkScreen /> }] },
          { path: '/c/:id', element: <BareShell />, children: [{ index: true, element: <ContractorLinkScreen /> }] },
          {
            path: '/profile',
            element: <BareShell />,
            children: [
              {
                index: true,
                lazy: async () => ({ Component: (await import('../screens/profile/ProfileScreen')).ProfileScreen }),
              },
              {
                path: 'help',
                lazy: async () => ({ Component: (await import('../screens/profile/HelpScreen')).HelpScreen }),
              },
              {
                path: '2-step',
                lazy: async () => ({
                  Component: (await import('../screens/twostep/TurnOnTwoStepScreen')).TurnOnTwoStepScreen,
                }),
              },
              {
                path: '2-step/codes',
                lazy: async () => ({
                  Component: (await import('../screens/twostep/NewBackupCodesScreen')).NewBackupCodesScreen,
                }),
              },
            ],
          },

          // Manager
          {
            element: <RequireRole roles={['manager']} area="the manager screens" />,
            children: [
              {
                element: <Shell />,
                children: [
                  {
                    path: '/tickets',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/OpenTicketsScreen')).OpenTicketsScreen,
                    }),
                  },
                  {
                    path: '/tickets/new',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/CreateAreaScreen')).CreateAreaScreen,
                    }),
                  },
                  {
                    path: '/tickets/in-house',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/InHouseScreen')).InHouseScreen,
                    }),
                  },
                  {
                    path: '/walkthrough',
                    lazy: async () => ({
                      Component: (await import('../screens/walkthrough/WalkthroughHomeScreen')).WalkthroughHomeScreen,
                    }),
                  },
                  {
                    path: '/equipment',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/EquipmentScreen')).EquipmentScreen,
                    }),
                  },
                ],
              },
              {
                element: <BareShell />,
                children: [
                  // Quarterly tasks (OT-107) and Review & submit (OT-109) replace these.
                  { path: '/walkthrough/:id/review', ...placeholder('Review & submit', 'OT-109') },
                  { path: '/walkthrough/:id/quarterly', ...placeholder('Quarterly tasks', 'OT-107') },
                  {
                    path: '/walkthrough/:walkthroughId/:section/ticket/:id',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/EditTicketScreen')).EditTicketScreen,
                    }),
                  },
                  {
                    path: '/walkthrough/:id/:section',
                    lazy: async () => ({
                      Component: (await import('../screens/walkthrough/ChecklistScreen')).ChecklistScreen,
                    }),
                  },
                  {
                    path: '/tickets/closed',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/ClosedTicketsScreen')).ClosedTicketsScreen,
                    }),
                  },
                  {
                    path: '/tickets/new/:categoryId',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/CreateFormScreen')).CreateFormScreen,
                    }),
                  },
                  {
                    path: '/equipment/new',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/EquipmentFormScreen')).AddEquipmentScreen,
                    }),
                  },
                  {
                    path: '/equipment/:id/edit',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/EquipmentFormScreen')).EditEquipmentScreen,
                    }),
                  },
                  {
                    path: '/equipment/:id/:tab?',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/EquipmentDetailScreen')).EquipmentDetailScreen,
                    }),
                  },
                  {
                    path: '/tickets/:id',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/TicketScreen')).TicketScreen,
                    }),
                  },
                  {
                    path: '/tickets/:id/edit',
                    lazy: async () => ({
                      Component: (await import('../screens/tickets/EditTicketScreen')).EditTicketScreen,
                    }),
                  },
                ],
              },
            ],
          },

          // Ops
          {
            element: <RequireRole roles={['ops']} area="the operations screens" />,
            children: [
              {
                element: <Shell />,
                children: [
                  {
                    path: '/ops',
                    lazy: async () => ({
                      Component: (await import('../screens/ops/OpsDashboardScreen')).OpsDashboardScreen,
                    }),
                  },
                  {
                    path: '/ops/closed',
                    lazy: async () => ({ Component: (await import('../screens/ops/OpsClosedScreen')).OpsClosedScreen }),
                  },
                  { path: '/ops/walkthroughs', ...placeholder('Walkthroughs', 'Phase 6b') },
                  {
                    path: '/ops/equipment',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/OpsEquipmentScreen')).OpsEquipmentScreen,
                    }),
                  },
                  {
                    path: '/ops/contractors',
                    lazy: async () => ({
                      Component: (await import('../screens/contractors/ContractorsScreen')).ContractorsScreen,
                    }),
                  },
                  {
                    path: '/ops/contractors/invoices',
                    lazy: async () => ({
                      Component: (await import('../screens/contractors/InvoicesScreen')).InvoicesScreen,
                    }),
                  },
                ],
              },
              {
                element: <BareShell />,
                children: [
                  {
                    path: '/ops/equipment/new',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/EquipmentFormScreen')).OpsAddEquipmentScreen,
                    }),
                  },
                  {
                    path: '/ops/equipment/categories',
                    lazy: async () => ({
                      Component: (await import('../screens/categories/CategoriesScreen')).OpsCategoriesScreen,
                    }),
                  },
                  {
                    path: '/ops/contractors/trades',
                    lazy: async () => ({
                      Component: (await import('../screens/trades/TradesScreen')).OpsTradesScreen,
                    }),
                  },
                  {
                    path: '/ops/equipment/:id/edit',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/EquipmentFormScreen')).OpsEditEquipmentScreen,
                    }),
                  },
                  {
                    path: '/ops/equipment/:id/:tab?',
                    lazy: async () => ({
                      Component: (await import('../screens/equipment/EquipmentDetailScreen')).OpsEquipmentDetailScreen,
                    }),
                  },
                  {
                    path: '/ops/tickets/:id',
                    lazy: async () => ({ Component: (await import('../screens/ops/OpsTicketScreen')).OpsTicketScreen }),
                  },
                  {
                    path: '/ops/tickets/:id/service/new',
                    lazy: async () => ({
                      Component: (await import('../screens/service/LogServiceScreen')).LogServiceFromTicketScreen,
                    }),
                  },
                  {
                    path: '/ops/equipment/:id/service/new',
                    lazy: async () => ({
                      Component: (await import('../screens/service/LogServiceScreen')).LogServiceFromEquipmentScreen,
                    }),
                  },
                  {
                    path: '/ops/service/:id',
                    lazy: async () => ({
                      Component: (await import('../screens/service/ServiceRecordScreen')).ServiceRecordScreen,
                    }),
                  },
                  {
                    path: '/ops/service/:id/edit',
                    lazy: async () => ({
                      Component: (await import('../screens/service/EditServiceScreen')).EditServiceScreen,
                    }),
                  },
                  {
                    path: '/ops/contractors/new',
                    lazy: async () => ({
                      Component: (await import('../screens/contractors/ContractorFormScreen')).AddContractorScreen,
                    }),
                  },
                  {
                    path: '/ops/contractors/:id/edit',
                    lazy: async () => ({
                      Component: (await import('../screens/contractors/ContractorFormScreen')).EditContractorScreen,
                    }),
                  },
                  {
                    path: '/ops/contractors/:id/:tab?',
                    lazy: async () => ({
                      Component: (await import('../screens/contractors/ContractorScreen')).ContractorScreen,
                    }),
                  },
                  {
                    path: '/ops/contractors/:id/service/new',
                    lazy: async () => ({
                      Component: (await import('../screens/service/LogServiceScreen')).LogServiceFromContractorScreen,
                    }),
                  },
                ],
              },
            ],
          },

          // Admin
          {
            element: <RequireRole roles={['admin']} area="the admin screens" />,
            children: [
              {
                element: <Shell />,
                children: [
                  { path: '/admin', element: <Navigate to="/admin/users" replace /> },
                  {
                    path: '/admin/users',
                    lazy: async () => ({ Component: (await import('../screens/admin/UsersScreen')).UsersScreen }),
                  },
                  {
                    path: '/admin/roles',
                    lazy: async () => ({ Component: (await import('../screens/admin/RolesScreen')).RolesScreen }),
                  },
                  { path: '/admin/tickets', ...placeholder('Tickets', 'Phase 7') },
                  {
                    path: '/admin/restaurants',
                    lazy: async () => ({
                      Component: (await import('../screens/admin/RestaurantsScreen')).RestaurantsScreen,
                    }),
                  },
                  {
                    path: '/admin/restaurants/categories',
                    lazy: async () => ({
                      Component: (await import('../screens/categories/CategoriesScreen')).AdminCategoriesScreen,
                    }),
                  },
                  {
                    path: '/admin/restaurants/trades',
                    lazy: async () => ({
                      Component: (await import('../screens/trades/TradesScreen')).AdminTradesScreen,
                    }),
                  },
                ],
              },
              {
                element: <BareShell />,
                children: [
                  {
                    path: '/admin/users/new',
                    lazy: async () => ({
                      Component: (await import('../screens/admin/InviteUserScreen')).InviteUserScreen,
                    }),
                  },
                  {
                    path: '/admin/users/:id',
                    lazy: async () => ({
                      Component: (await import('../screens/admin/UserProfileScreen')).UserProfileScreen,
                    }),
                  },
                  {
                    path: '/admin/users/:id/view',
                    lazy: async () => ({ Component: (await import('../screens/admin/ViewAsScreen')).ViewAsScreen }),
                  },
                  {
                    path: '/admin/roles/edit',
                    lazy: async () => ({ Component: (await import('../screens/admin/RolesScreen')).EditRolesScreen }),
                  },
                  {
                    path: '/admin/restaurants/new',
                    lazy: async () => ({
                      Component: (await import('../screens/admin/AddRestaurantScreen')).AddRestaurantScreen,
                    }),
                  },
                  {
                    path: '/admin/restaurants/:id/edit',
                    lazy: async () => ({
                      Component: (await import('../screens/admin/EditRestaurantScreen')).EditRestaurantScreen,
                    }),
                  },
                ],
              },
            ],
          },

          // Leadership
          {
            element: <RequireRole roles={['leadership']} area="the leadership screens" />,
            children: [
              {
                element: <Shell />,
                children: [
                  { path: '/lead', ...placeholder('Overview', 'Phase 7') },
                  { path: '/lead/restaurants', ...placeholder('Restaurants', 'Phase 7') },
                  { path: '/lead/walkthroughs', ...placeholder('Walkthroughs', 'Phase 7') },
                  { path: '/lead/contractors', ...placeholder('Contractors', 'Phase 7') },
                ],
              },
            ],
          },
        ],
      },

      // A splat route cannot have an index child, so the 404 board is its element.
      {
        path: '*',
        element: (
          <BareShell>
            <NotFoundScreen />
          </BareShell>
        ),
      },
    ],
  },
])
