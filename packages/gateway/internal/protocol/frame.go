package protocol

import "encoding/binary"

const (
	FrameOpenStream   = 0x01
	FrameStreamData   = 0x02
	FrameStreamEnd    = 0x03
	FrameStreamCancel = 0x04
	FrameResponseHdrs = 0x05
	FrameWSUpgrade    = 0x06
	FrameWSData       = 0x07
	FrameWSClose      = 0x08
	FramePing         = 0x09
	FramePong         = 0x0a
	FramePause        = 0x0b
	FrameResume       = 0x0c
	ControlStreamID   = 0
)

func StreamID(frame []byte) uint32 {
	return binary.BigEndian.Uint32(frame[1:5])
}

func Frame(frameType byte, streamID uint32, payload []byte) []byte {
	frame := make([]byte, 5+len(payload))
	frame[0] = frameType
	binary.BigEndian.PutUint32(frame[1:5], streamID)
	copy(frame[5:], payload)
	return frame
}
