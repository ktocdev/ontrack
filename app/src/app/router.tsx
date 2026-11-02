import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth, RequireRole, RoleHome } from '../auth/guards'
import { SignInScreen } from '../screens/auth/SignInScreen'
import { NoAccessScreen } from '../screens/errors/NoAccessScreen'
import { NotFoundScreen } from '../screens/errors/NotFoundScreen'
import { RouteErrorScreen, ServerErrorScreen } from '../screens/errors/ServerErrorScreen'
import { LinkExpiredScreen } from '../screens/invite/LinkExpiredScreen'
import { CenteredLoading, CheckingInvite } from '../screens/loading/CenteredLoading'
import { PlaceholderScreen } from '../screens/placeholder/PlaceholderScreen'
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
                  { path: '/walkthrough', ...placeholder('Walkthrough', 'Phase 6a') },
                  { path: '/equipment', ...placeholder('Equipment', 'Phase 4') },
                ],
              },
              {
                element: <BareShell />,
                children: [
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
                  { path: '/ops/closed', ...placeholder('Closed', 'Phase 3', 'OT-41 builds this.') },
                  { path: '/ops/walkthroughs', ...placeholder('Walkthroughs', 'Phase 6b') },
                  { path: '/ops/equipment', ...placeholder('Equipment', 'Phase 4') },
                  { path: '/ops/contractors', ...placeholder('Contractors', 'Phase 5') },
                ],
              },
              {
                element: <BareShell />,
                children: [{ path: '/ops/tickets/:id', ...placeholder('Ticket', 'Phase 3', 'OT-39 builds this.') }],
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
