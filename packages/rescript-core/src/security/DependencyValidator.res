// Sprint 1 Day 4: Dependency Validation
// Security Module: T6 Mitigation - Spoofed Dependency Validation (Critical/P0)
//
// Purpose: Verify dependency checksums and validate signed config bundles
// Architecture: SHA-256 checksum validation + config bundle signature verification
// Compliance: Zero warnings required for merge

open Belt

// Checksum validation result
type checksumResult =
  | ChecksumValid
  | ChecksumMismatch(string)
  | MissingChecksum
  | InvalidChecksumFormat(string)

// Config bundle validation result
type bundleResult =
  | BundleValid
  | BundleInvalid(string)
  | BundleSignatureMismatch
  | MissingBundleSignature

// Dependency definition with checksum
type dependency = {
  name: string,
  version: string,
  checksum: option<string>,
}

// Config bundle definition
type configBundle = {
  bundleId: string,
  version: string,
  dependencies: array<dependency>,
  signature: option<string>,
}

// Create dependency
let createDependency = (
  ~name: string,
  ~version: string,
  ~checksum: option<string>=?,
  (),
): dependency => {
  {
    name: name,
    version: version,
    checksum: checksum,
  }
}

// Create config bundle
let createConfigBundle = (
  ~bundleId: string,
  ~version: string,
  ~dependencies: array<dependency>,
  ~signature: option<string>=?,
  (),
): configBundle => {
  {
    bundleId: bundleId,
    version: version,
    dependencies: dependencies,
    signature: signature,
  }
}

// SHA-256 checksum verification (delegated to TypeScript/Node.js crypto)
// Note: Actual crypto operations happen in TypeScript layer via FFI
type checksumVerifier = (string, string) => bool

// Verify dependency checksum
let verifyChecksum = (
  dependency: dependency,
  actualChecksum: string,
  checksumVerifier: checksumVerifier,
): checksumResult => {
  switch dependency.checksum {
  | None => MissingChecksum
  | Some(expectedChecksum) => {
      if String.length(expectedChecksum) == 0 {
        InvalidChecksumFormat("checksum cannot be empty")
      } else if String.length(expectedChecksum) != 64 {
        // SHA-256 produces 64-character hex string
        InvalidChecksumFormat("checksum must be 64-character SHA-256 hash")
      } else {
        let isValid = checksumVerifier(actualChecksum, expectedChecksum)

        if isValid {
          ChecksumValid
        } else {
          ChecksumMismatch(
            `Expected: ${expectedChecksum}, Actual: ${actualChecksum}`
          )
        }
      }
    }
  }
}

// Convert config bundle to canonical string for signing
let bundleToCanonicalString = (bundle: configBundle): string => {
  let depsStr = Array.map(bundle.dependencies, dep => {
    let checksumStr = switch dep.checksum {
    | None => "none"
    | Some(cs) => cs
    }
    `${dep.name}@${dep.version}:${checksumStr}`
  })->Array.joinWith(";", x => x)

  `${bundle.bundleId}:${bundle.version}:${depsStr}`
}

// HMAC-SHA256 signature verification for config bundle
type bundleSignatureVerifier = (string, string, string) => bool

// Verify config bundle signature
let verifyBundleSignature = (
  bundle: configBundle,
  secretKey: string,
  signatureVerifier: bundleSignatureVerifier,
): bundleResult => {
  switch bundle.signature {
  | None => MissingBundleSignature
  | Some(sig) => {
      if String.length(sig) == 0 {
        BundleInvalid("signature cannot be empty")
      } else {
        let canonical = bundleToCanonicalString(bundle)
        let isValid = signatureVerifier(canonical, secretKey, sig)

        if isValid {
          BundleValid
        } else {
          BundleSignatureMismatch
        }
      }
    }
  }
}

// Validate all dependencies in a bundle have valid checksums
let validateBundleDependencies = (
  bundle: configBundle,
  getActualChecksum: string => string,
  checksumVerifier: checksumVerifier,
): result<unit, string> => {
  let invalidDeps = Array.keepMap(bundle.dependencies, dep => {
    let actualChecksum = getActualChecksum(dep.name)
    let checksumResult = verifyChecksum(dep, actualChecksum, checksumVerifier)

    switch checksumResult {
    | ChecksumValid => None
    | ChecksumMismatch(msg) => Some(`${dep.name}: ${msg}`)
    | MissingChecksum => Some(`${dep.name}: missing checksum`)
    | InvalidChecksumFormat(msg) => Some(`${dep.name}: ${msg}`)
    }
  })

  if Array.length(invalidDeps) > 0 {
    let errorMsg = Array.joinWith(invalidDeps, ", ", x => x)
    Error(`Invalid dependencies: ${errorMsg}`)
  } else {
    Ok()
  }
}

// Combined validation: Bundle signature + all dependency checksums
let validateConfigBundle = (
  bundle: configBundle,
  secretKey: string,
  getActualChecksum: string => string,
  checksumVerifier: checksumVerifier,
  signatureVerifier: bundleSignatureVerifier,
): result<configBundle, string> => {
  // First verify bundle signature
  switch verifyBundleSignature(bundle, secretKey, signatureVerifier) {
  | BundleValid => {
      // Then validate all dependency checksums
      switch validateBundleDependencies(bundle, getActualChecksum, checksumVerifier) {
      | Ok() => Ok(bundle)
      | Error(msg) => Error(`Dependency validation failed: ${msg}`)
      }
    }
  | BundleSignatureMismatch => Error("Bundle signature mismatch")
  | MissingBundleSignature => Error("Bundle signature missing")
  | BundleInvalid(reason) => Error(`Bundle invalid: ${reason}`)
  }
}

// Helper: Convert checksum result to string
let checksumResultToString = (result: checksumResult): string => {
  switch result {
  | ChecksumValid => "ChecksumValid"
  | ChecksumMismatch(msg) => `ChecksumMismatch(${msg})`
  | MissingChecksum => "MissingChecksum"
  | InvalidChecksumFormat(msg) => `InvalidChecksumFormat(${msg})`
  }
}

// Helper: Convert bundle result to string
let bundleResultToString = (result: bundleResult): string => {
  switch result {
  | BundleValid => "BundleValid"
  | BundleInvalid(msg) => `BundleInvalid(${msg})`
  | BundleSignatureMismatch => "BundleSignatureMismatch"
  | MissingBundleSignature => "MissingBundleSignature"
  }
}

// Helper: Check if checksum is valid
let isChecksumValid = (result: checksumResult): bool => {
  switch result {
  | ChecksumValid => true
  | _ => false
  }
}

// Helper: Check if bundle is valid
let isBundleValid = (result: bundleResult): bool => {
  switch result {
  | BundleValid => true
  | _ => false
  }
}
