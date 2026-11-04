import { useQuery } from "@tanstack/react-query";
import { getInitialAuth, getMe } from "@/services/api";
import { getJwtToken } from "@/services/cfsm/config";

export function useAuth() {
  return useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => getMe({ signal }),
    // 没有本地 JWT 时登录态未知（可能是 Cookie 会话）：等接口回答，不能先按访客处理。
    initialData: () => (getJwtToken() ? getInitialAuth() : undefined),
    staleTime: 30_000,
    // 后台在新标签页登录后，返回时必须立即校验。
    refetchOnWindowFocus: "always",
  });
}

