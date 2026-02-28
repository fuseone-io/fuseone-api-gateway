package model

type DataResponse struct {
	Data any            `json:"data"`
	Meta map[string]any `json:"meta,omitempty"`
}

type ListResponse struct {
	Data any            `json:"data"`
	Meta map[string]any `json:"meta,omitempty"`
}

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func NewDataResponse(data any) DataResponse {
	return DataResponse{Data: data}
}

func NewListResponse(data any, total, page, pageSize int) ListResponse {
	return ListResponse{
		Data: data,
		Meta: map[string]any{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	}
}

func NewErrorResponse(code, message string) ErrorResponse {
	return ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
		},
	}
}
