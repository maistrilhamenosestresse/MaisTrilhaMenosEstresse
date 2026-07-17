import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasMemberAccess, REQUIRED_PAID_TRAILS } from '@/lib/member-access'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  const isAdmin = !!user?.email && (user.app_metadata?.role === 'admin' || adminEmails.includes(user.email.toLowerCase()))
  const isAppRoute = request.nextUrl.pathname.startsWith('/app')
  const isAppLogin = request.nextUrl.pathname.startsWith('/app/login')

  if (isAppRoute && !isAppLogin && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/app/login'
    return NextResponse.redirect(url)
  }

  if (user && isAppRoute) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, membro_vip')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    let paidTrails = 0
    let reservationError: { message: string } | null = null

    if (client) {
      const result = await supabase
        .from('reservas')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('status_pagamento', 'pago')
      paidTrails = result.count || 0
      reservationError = result.error
    }

    const accessCheckFailed = !!clientError || !!reservationError
    const eligible = !accessCheckFailed && !!client && hasMemberAccess(paidTrails, client.membro_vip === true)

    if (eligible && isAppLogin) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (!eligible && !isAppLogin) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/login'
      url.search = ''
      url.searchParams.set('reason', accessCheckFailed ? 'access-check' : 'member-access')
      url.searchParams.set('required', String(REQUIRED_PAID_TRAILS))
      if (!accessCheckFailed && client) url.searchParams.set('paid', String(paidTrails))
      return NextResponse.redirect(url)
    }
  }

  if (request.nextUrl.pathname.startsWith('/admin') && !isAdmin) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário já está logado, não precisa acessar a rota /login novamente
  if (isAdmin && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
