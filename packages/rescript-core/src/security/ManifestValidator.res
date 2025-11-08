// Sprint 1 Day 4: Manifest Validation
// Security Module: T1 Mitigation - Malicious Manifest Smuggling (Critical/P0)
//
// Purpose: Validate task manifest structure and verify HMAC-SHA256 signatures
// Architecture: Schema validation with Zod integration + cryptographic signature verification
// Compliance: Zero warnings required for merge

open Belt

// Manifest validation result
type validationResult =
  | Valid
  | Invalid(string)

// Manifest signature verification result
type signatureResult =
  | Verified
  | SignatureMismatch
  | MissingSignature
  | InvalidFormat(string)

// Manifest structure definition
type manifest = {
  taskId: string,
  manifestVersion: string,
  dependencies: array<string>,
  metadata: option<Js.Dict.t<Js.Json.t>>,
  signature: option<string>,
}

// Create manifest from raw data
let createManifest = (
  ~taskId: string,
  ~manifestVersion: string,
  ~dependencies: array<string>,
  ~metadata: option<Js.Dict.t<Js.Json.t>>=?,
  ~signature: option<string>=?,
  (),
): manifest => {
  {
    taskId: taskId,
    manifestVersion: manifestVersion,
    dependencies: dependencies,
    metadata: metadata,
    signature: signature,
  }
}

// Schema validation: Check manifest structure compliance
let validateSchema = (manifest: manifest): validationResult => {
  // Validate taskId is non-empty
  if String.length(manifest.taskId) == 0 {
    Invalid("taskId cannot be empty")
  } else if String.length(manifest.manifestVersion) == 0 {
    Invalid("manifestVersion cannot be empty")
  } else if Array.length(manifest.dependencies) == 0 {
    Invalid("dependencies array cannot be empty")
  } else {
    // Check all dependencies are non-empty strings
    let hasEmptyDep = Array.some(manifest.dependencies, dep => String.length(dep) == 0)
    if hasEmptyDep {
      Invalid("dependencies cannot contain empty strings")
    } else {
      Valid
    }
  }
}

// Convert manifest to canonical string for signing
let manifestToCanonicalString = (manifest: manifest): string => {
  let depsStr = Array.joinWith(manifest.dependencies, ",", x => x)
  let metadataStr = switch manifest.metadata {
  | None => ""
  | Some(dict) => {
      // Simple JSON-like string representation (for signing purposes)
      let pairs = Js.Dict.entries(dict)->Array.map(((key, _value)) => key)
      Array.joinWith(pairs, ",", x => x)
    }
  }

  `${manifest.taskId}:${manifest.manifestVersion}:${depsStr}:${metadataStr}`
}

// HMAC-SHA256 signature verification (delegated to TypeScript/Node.js crypto)
// Note: Actual crypto operations happen in TypeScript layer via FFI
type hmacVerifier = (string, string, string) => bool

// Verify manifest signature using provided HMAC verifier
let verifySignature = (
  manifest: manifest,
  secretKey: string,
  hmacVerifier: hmacVerifier,
): signatureResult => {
  switch manifest.signature {
  | None => MissingSignature
  | Some(sig) => {
      if String.length(sig) == 0 {
        InvalidFormat("signature cannot be empty")
      } else {
        let canonical = manifestToCanonicalString(manifest)
        let isValid = hmacVerifier(canonical, secretKey, sig)

        if isValid {
          Verified
        } else {
          SignatureMismatch
        }
      }
    }
  }
}

// Combined validation: Schema + Signature
let validateManifest = (
  manifest: manifest,
  secretKey: string,
  hmacVerifier: hmacVerifier,
): result<manifest, string> => {
  // First validate schema
  switch validateSchema(manifest) {
  | Invalid(reason) => Error(`Schema validation failed: ${reason}`)
  | Valid => {
      // Then verify signature
      switch verifySignature(manifest, secretKey, hmacVerifier) {
      | Verified => Ok(manifest)
      | SignatureMismatch => Error("Signature verification failed: signature mismatch")
      | MissingSignature => Error("Signature verification failed: missing signature")
      | InvalidFormat(reason) => Error(`Signature verification failed: ${reason}`)
      }
    }
  }
}

// Helper: Convert validation result to string
let validationResultToString = (result: validationResult): string => {
  switch result {
  | Valid => "Valid"
  | Invalid(reason) => `Invalid(${reason})`
  }
}

// Helper: Convert signature result to string
let signatureResultToString = (result: signatureResult): string => {
  switch result {
  | Verified => "Verified"
  | SignatureMismatch => "SignatureMismatch"
  | MissingSignature => "MissingSignature"
  | InvalidFormat(reason) => `InvalidFormat(${reason})`
  }
}

// Helper: Extract error message from result
let getErrorMessage = (result: result<'a, string>): option<string> => {
  switch result {
  | Ok(_) => None
  | Error(msg) => Some(msg)
  }
}

// Helper: Check if validation passed
let isValid = (result: validationResult): bool => {
  switch result {
  | Valid => true
  | Invalid(_) => false
  }
}

// Helper: Check if signature verified
let isVerified = (result: signatureResult): bool => {
  switch result {
  | Verified => true
  | _ => false
  }
}
