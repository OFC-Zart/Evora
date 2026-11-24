import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/", "/entrar", "/auth"];

// Renova a sessão do Supabase a cada navegação e protege as telas do app.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl: url, supabaseAnonKey: key } = publicEnv();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")));
  if (!user && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/entrar";
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  if (user && (path === "/" || path === "/entrar")) {
    const to = request.nextUrl.clone();
    to.pathname = "/hoje";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: [
    // tudo menos API, estáticos, ícones, manifest e service worker
    "/((?!api|_next/static|_next/image|icons|favicon.ico|manifest.webmanifest|sw.js|.*\.(?:png|svg|ico|webp)$).*)",
  ],
};
