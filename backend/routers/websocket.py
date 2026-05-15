from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, List
import asyncio, json, datetime

router = APIRouter()

# In-memory connection manager
class ConnectionManager:
    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}  # deployment_id -> [ws]

    async def connect(self, deployment_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(deployment_id, []).append(ws)

    def disconnect(self, deployment_id: int, ws: WebSocket):
        if deployment_id in self.active:
            self.active[deployment_id] = [
                c for c in self.active[deployment_id] if c != ws
            ]

    async def broadcast(self, deployment_id: int, message: dict):
        connections = self.active.get(deployment_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(deployment_id, ws)


manager = ConnectionManager()


@router.websocket("/deployments/{deployment_id}/logs")
async def deployment_logs_ws(
    websocket: WebSocket,
    deployment_id: int,
):
    """
    WebSocket endpoint for streaming real-time deployment logs and status.
    Uses Redis Pub/Sub to listen for events from workers.
    """
    from database import REDIS_URL
    import aioredis
    
    await websocket.accept()
    
    # 1. Send initial connection acknowledgement
    await websocket.send_json({
        "type": "connected",
        "deployment_id": deployment_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    })

    # 2. Subscribe to Redis Channel
    redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis.pubsub()
    channel = f"deployment:{deployment_id}"
    await pubsub.subscribe(channel)

    try:
        # Task to listen to Redis and forward to WebSocket
        async def redis_listener():
            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = json.loads(message["data"])
                        await websocket.send_json(data)
            except Exception as e:
                print(f"[WS] Redis listener error: {e}")

        # Task to keep connection alive and handle client pings
        async def client_handler():
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "keepalive"})
                except Exception:
                    break

        # Run both tasks concurrently
        await asyncio.gather(redis_listener(), client_handler())

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] WebSocket error: {e}")
    finally:
        await pubsub.unsubscribe(channel)
        await redis.close()



@router.websocket("/projects/{project_id}/status")
async def project_status_ws(
    websocket: WebSocket,
    project_id: int,
):
    """WebSocket for project analysis status updates."""
    from database import REDIS_URL
    import aioredis
    
    await websocket.accept()
    
    redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis.pubsub()
    channel = f"project:{project_id}"
    await pubsub.subscribe(channel)

    try:
        async def redis_listener():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await websocket.send_json(json.loads(message["data"]))

        async def client_handler():
            while True:
                try:
                    await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                except:
                    break

        await asyncio.gather(redis_listener(), client_handler())
    except:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await redis.close()

