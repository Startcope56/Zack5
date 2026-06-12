import { useState } from "react";
import {
  useSearchUsers, useGetAdminReports, useAdminReportAction, useAdminUserAction,
  getGetAdminReportsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, AlertTriangle, Users, CheckCircle, XCircle, Trash2, Ban, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  remove_post: { label: "Remove Post", icon: <Trash2 className="h-3.5 w-3.5" />, color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  restrict_account: { label: "Restrict", icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  ban_account: { label: "Ban", icon: <Ban className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-700 hover:bg-red-200" },
  dismiss_report: { label: "Dismiss", icon: <XCircle className="h-3.5 w-3.5" />, color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  restore_account: { label: "Restore", icon: <CheckCircle className="h-3.5 w-3.5" />, color: "bg-green-100 text-green-700 hover:bg-green-200" },
};

export default function AdminPage() {
  const { data: users, isLoading: usersLoading } = useSearchUsers({ q: "" });
  const { data: reports, isLoading: reportsLoading } = useGetAdminReports({});
  const reportAction = useAdminReportAction();
  const userAction = useAdminUserAction();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "reports" | "users">("overview");
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const pendingReports = reports?.filter(r => r.status === "pending") || [];

  const handleReportAction = async (reportId: number, action: string) => {
    try {
      const res = await reportAction.mutateAsync({ id: reportId, data: { action: action as any } });
      toast({ title: "✅ " + (res.message || "Action taken") });
      queryClient.invalidateQueries({ queryKey: getGetAdminReportsQueryKey() });
      setSelectedReport(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleUserAction = async (userId: number, action: string) => {
    try {
      await userAction.mutateAsync({ id: userId, data: { action: action as any } });
      toast({ title: "✅ Action taken on user" });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
          <Shield className="h-5 w-5 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: "overview", label: "Overview" },
          { id: "reports", label: `Reports ${pendingReports.length > 0 ? `(${pendingReports.length})` : ""}` },
          { id: "users", label: "Users" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{users?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" /> Pending Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${pendingReports.length > 0 ? "text-orange-500" : "text-green-500"}`}>
                  {pendingReports.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">Healthy</div>
              </CardContent>
            </Card>
          </div>

          {pendingReports.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Pending Reports Need Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button size="sm" onClick={() => setTab("reports")} className="bg-orange-500 hover:bg-orange-600 text-white">
                  Review {pendingReports.length} report{pendingReports.length > 1 ? "s" : ""}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {tab === "reports" && (
        <div className="space-y-4">
          {reportsLoading && <div className="text-center py-8 text-muted-foreground">Loading reports...</div>}
          {reports?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              ✅ No reports yet
            </div>
          )}
          {reports?.map(r => (
            <Card key={r.id} className={`${r.status === "pending" ? "border-orange-200" : "opacity-60"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={r.status === "pending" ? "destructive" : "secondary"} className="text-[10px]">
                        {r.status.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {r.reason.replace(/_/g, " ")}
                      </Badge>
                      {r.reportedPost && <Badge variant="outline" className="text-[10px]">POST</Badge>}
                      {r.reportedUser && <Badge variant="outline" className="text-[10px]">USER</Badge>}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={r.reporter?.profilePicture || undefined} />
                        <AvatarFallback className="text-xs">{r.reporter?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs text-gray-600">
                        Reported by <strong>{r.reporter?.name}</strong>
                      </p>
                    </div>

                    {r.reportedUser && (
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={r.reportedUser.profilePicture || undefined} />
                          <AvatarFallback className="text-xs">{r.reportedUser.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-gray-600">
                          User: <strong>{r.reportedUser.name}</strong>
                          {(r.reportedUser as any).restricted && <span className="ml-1 text-orange-600">(restricted)</span>}
                          {(r.reportedUser as any).banned && <span className="ml-1 text-red-600">(banned)</span>}
                        </p>
                      </div>
                    )}

                    {r.reportedPost && (
                      <div className="mt-2 bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Post content:</p>
                        <p className="text-xs text-gray-700 truncate">{r.reportedPost.content}</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(r.createdAt), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>

                  {r.status === "pending" && (
                    <button
                      onClick={() => setSelectedReport(r)}
                      className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" /> Actions
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users?.map(user => (
                <div key={user.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.profilePicture || undefined} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold flex items-center gap-2 text-sm">
                        {user.name}
                        {user.isAdmin && <span className="px-1.5 py-0.5 text-[9px] bg-yellow-100 text-yellow-700 rounded-full font-bold uppercase">Admin</span>}
                        {user.blueBadge && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] font-bold" style={{ background: "#1877f2" }}>✓</span>}
                        {(user as any).restricted && <span className="px-1.5 py-0.5 text-[9px] bg-orange-100 text-orange-700 rounded-full font-bold">Restricted</span>}
                        {(user as any).banned && <span className="px-1.5 py-0.5 text-[9px] bg-red-100 text-red-700 rounded-full font-bold">Banned</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                  {!user.isAdmin && (
                    <div className="flex gap-1">
                      {(user as any).banned ? (
                        <button
                          onClick={() => handleUserAction(user.id, "restore_account")}
                          className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded-lg transition"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          {!(user as any).restricted && (
                            <button
                              onClick={() => handleUserAction(user.id, "restrict_account")}
                              className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-2 py-1 rounded-lg transition"
                            >
                              Restrict
                            </button>
                          )}
                          <button
                            onClick={() => handleUserAction(user.id, "ban_account")}
                            className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded-lg transition"
                          >
                            Ban
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Action Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={o => !o && setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take Action on Report 🛡️</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-medium">Reason: <span className="text-orange-600">{selectedReport.reason.replace(/_/g, " ")}</span></p>
                {selectedReport.reportedPost && (
                  <p className="text-xs text-gray-600 mt-1">Post: "{selectedReport.reportedPost.content?.substring(0, 80)}..."</p>
                )}
                {selectedReport.reportedUser && (
                  <p className="text-xs text-gray-600 mt-1">User: {selectedReport.reportedUser.name}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selectedReport.reportedPost && (
                  <button
                    onClick={() => handleReportAction(selectedReport.id, "remove_post")}
                    disabled={reportAction.isPending}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition"
                  >
                    <Trash2 className="h-4 w-4" /> Remove Post
                  </button>
                )}
                {(selectedReport.reportedUser || selectedReport.reportedPost) && (
                  <button
                    onClick={() => handleReportAction(selectedReport.id, "restrict_account")}
                    disabled={reportAction.isPending}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition"
                  >
                    <AlertTriangle className="h-4 w-4" /> Restrict Account
                  </button>
                )}
                {(selectedReport.reportedUser || selectedReport.reportedPost) && (
                  <button
                    onClick={() => handleReportAction(selectedReport.id, "ban_account")}
                    disabled={reportAction.isPending}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition"
                  >
                    <Ban className="h-4 w-4" /> Ban Account
                  </button>
                )}
                <button
                  onClick={() => handleReportAction(selectedReport.id, "dismiss_report")}
                  disabled={reportAction.isPending}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                  <XCircle className="h-4 w-4" /> Dismiss
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
