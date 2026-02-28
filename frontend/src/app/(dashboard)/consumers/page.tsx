"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { api } from "@/lib/api-client"
import type { APISIXConsumer } from "@/types/apisix"

export default function ConsumersPage() {
  const [consumers, setConsumers] = useState<APISIXConsumer[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteUsername, setDeleteUsername] = useState<string | null>(null)

  const fetchConsumers = () => {
    setLoading(true)
    api
      .listResource("consumers")
      .then((data) => {
        const items = (data?.list || []).map((node) => node.value as APISIXConsumer)
        setConsumers(items)
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchConsumers()
  }, [])

  const handleDelete = async () => {
    if (!deleteUsername) return
    try {
      await api.deleteResource("consumers", deleteUsername)
      toast.success("Consumer deleted")
      fetchConsumers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleteUsername(null)
    }
  }

  function getPluginsCount(plugins?: Record<string, unknown>): number {
    return plugins ? Object.keys(plugins).length : 0
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consumers</h1>
          <p className="text-muted-foreground">
            Manage API consumers and their authentication credentials
          </p>
        </div>
        <Button asChild>
          <Link href="/consumers/new">
            <Plus className="mr-2 h-4 w-4" />
            New Consumer
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Plugins</TableHead>
              <TableHead>Group</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : consumers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No consumers configured</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/consumers/new">Create your first consumer</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              consumers.map((consumer) => (
                <TableRow key={consumer.username}>
                  <TableCell className="font-medium">
                    {consumer.username}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {consumer.desc || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getPluginsCount(consumer.plugins)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {consumer.group_id || "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/consumers/${consumer.username}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteUsername(consumer.username)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteUsername} onOpenChange={() => setDeleteUsername(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Consumer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete consumer &quot;{deleteUsername}&quot;? This
              action cannot be undone. All associated credentials will be removed.
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
