
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from eye_detector import detect_eyes
import base64
import binascii
import cv2
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Driver Drowsiness Detection API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"]
)
class FrameRequest(BaseModel):
    image: str


@app.get("/")
def home():
    return {
        "message": "Driver Drowsiness Detection API is running",
        "status": "success"
    }


@app.post("/detect")
def detect_frame(request: FrameRequest):
    try:
        image_data = request.image.split(",")[-1]

        image_bytes = base64.b64decode(
            image_data,
            validate=True
        )

        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if frame is None:
            raise ValueError("Invalid image")

        result = detect_eyes(frame)

        return result

    except (ValueError, binascii.Error) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )
