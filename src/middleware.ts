import { auth } from "@/auth";

const protectedPaths = ["/dashboard", "/courses", "/lectures", "/study", "/cards"];

function isProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isAuth = !!req.auth;

  if (isProtected(pathname) && !isAuth) {
    const signIn = new URL("/", nextUrl.origin);
    signIn.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signIn);
  }
  if (pathname === "/" && isAuth) {
    return Response.redirect(new URL("/dashboard", nextUrl.origin));
  }
  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
