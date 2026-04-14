import Foundation

final class APIClient: Sendable {
    let baseURL: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    var refineURL: URL {
        baseURL.appendingPathComponent("api/refine")
    }

    var refineStreamURL: URL {
        baseURL.appendingPathComponent("api/refine/stream")
    }

    func streamRefine(request: RefineRequestDTO) -> AsyncThrowingStream<StreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    var urlRequest = URLRequest(url: refineStreamURL)
                    urlRequest.httpMethod = "POST"
                    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    urlRequest.httpBody = try JSONEncoder().encode(request)

                    let (bytes, response) = try await URLSession.shared.bytes(for: urlRequest)

                    guard let httpResponse = response as? HTTPURLResponse,
                          httpResponse.statusCode == 200 else {
                        continuation.finish(throwing: APIError.httpError(
                            (response as? HTTPURLResponse)?.statusCode ?? 0
                        ))
                        return
                    }

                    for try await line in bytes.lines {
                        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { continue }
                        guard let data = trimmed.data(using: .utf8),
                              let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            continue
                        }
                        continuation.yield(StreamEvent(from: json))
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    func healthCheck() async -> Bool {
        guard let url = URL(string: "\(baseURL.absoluteString)/") else { return false }
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
}

enum APIError: Error, LocalizedError {
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .httpError(let code): "HTTP error: \(code)"
        }
    }
}
