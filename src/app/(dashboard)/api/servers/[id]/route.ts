import { NextResponse } from 'next/server'
import { getServer, deleteServer, rebootServer } from '@/lib/hetzner'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const server = await getServer(parseInt(id))
    return NextResponse.json({ server })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server nicht gefunden' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteServer(parseInt(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fehler beim Löschen' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action } = await req.json()

    if (action === 'reboot') {
      await rebootServer(parseInt(id))
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fehler' },
      { status: 500 }
    )
  }
}
