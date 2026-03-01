"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Lock,
  Search,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import type { APISIXSSL } from "@/types/apisix"

function getExpiryInfo(validity_end?: number) {
  if (!validity_end) return null
  const date = new Date(validity_end * 1000)
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86400000)
  return {
    date,
    daysLeft,
    expired: daysLeft < 0,
    expiringSoon: daysLeft >= 0 && daysLeft < 30,
  }
}

function formatShortDate(epoch?: number): string {
  if (!epoch) return "—"
  return new Date(epoch * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function SSLPage() {
  const [certs, setCerts] = useState<APISIXSSL[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchCerts = () => {
    setLoading(true)
    api
      .listResource("ssls")
      .then((data) => {
        const items = (data?.list || []).map((node) => node.value as APISIXSSL)
        setCerts(items)
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchCerts()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteResource("ssls", deleteId)
      toast.success("Certificate deleted")
      fetchCerts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleteId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return certs
    const q = search.toLowerCase()
    return certs.filter(
      (c) =>
        (c.id || "").toLowerCase().includes(q) ||
        (c.snis || []).some((sni) => sni.toLowerCase().includes(q))
    )
  }, [certs, search])

  const colCount = 6

  return (
    <div className="space-y-6">
      <PageHeader
        title="SSL / Certificates"
        description="Manage SSL/TLS certificates for HTTPS termination and mTLS"
        actions={
          <Button asChild>
            <Link href="/ssl/new">
              <Plus className="mr-2 h-4 w-4" />
              New Certificate
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID or domain..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>ID</TableHead>
              <TableHead>Domains</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Lock className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {search
                        ? "No certificates match your search"
                        : "No SSL certificates configured"}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/ssl/new">
                          Add your first certificate
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((cert) => {
                const expiry = getExpiryInfo(cert.validity_end)
                const hasMtls = !!cert.client?.ca

                return (
                  <TableRow key={cert.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      {cert.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(cert.snis || []).slice(0, 3).map((sni) => (
                          <Badge
                            key={sni}
                            variant="outline"
                            className="text-xs"
                          >
                            {sni}
                          </Badge>
                        ))}
                        {(cert.snis || []).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{cert.snis.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {cert.type || "server"}
                        </Badge>
                        {hasMtls && (
                          <Badge
                            variant="outline"
                            className="text-xs gap-1 border-blue-500/30 text-blue-600"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            mTLS
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expiry ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">
                            {formatShortDate(cert.validity_end)}
                          </span>
                          {expiry.expired && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-1 py-0"
                            >
                              Expired
                            </Badge>
                          )}
                          {expiry.expiringSoon && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1 py-0 text-amber-600"
                            >
                              {expiry.daysLeft}d
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          cert.status === 1 ? "default" : "secondary"
                        }
                      >
                        {cert.status === 1 ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/ssl/${cert.id}`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(cert.id!)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this SSL certificate? This action
              cannot be undone. HTTPS traffic using this certificate will be
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
