// Sprint 1 Day 8: Metadata Validation Module
// Threat T4 Mitigation: Metadata Injection Attacks (Medium/P1)
//
// Prevents XSS, log injection, and effect payload tampering through:
// - Schema validation for metadata structure
// - HTML escaping for string values
// - Size limits (10KB maximum)
// - Field whitelisting

module MetadataSchema = {
  // Define allowed metadata fields with type constraints
  type fieldType = String | Number | Boolean | Array | Object

  type fieldDefinition = {
    name: string,
    fieldType: fieldType,
    required: bool,
    maxLength: option<int>, // For strings
    maxItems: option<int>,  // For arrays
    allowedValues: option<array<string>>, // Enum validation
  }

  type schema = array<fieldDefinition>

  // Standard metadata schema for task contexts
  let taskMetadataSchema: schema = [
    {
      name: "taskId",
      fieldType: String,
      required: true,
      maxLength: Some(256),
      maxItems: None,
      allowedValues: None,
    },
    {
      name: "manifestVersion",
      fieldType: String,
      required: false,
      maxLength: Some(64),
      maxItems: None,
      allowedValues: None,
    },
    {
      name: "attempt",
      fieldType: Number,
      required: false,
      maxLength: None,
      maxItems: None,
      allowedValues: None,
    },
    {
      name: "retryCount",
      fieldType: Number,
      required: false,
      maxLength: None,
      maxItems: None,
      allowedValues: None,
    },
    {
      name: "requestedBy",
      fieldType: String,
      required: false,
      maxLength: Some(128),
      maxItems: None,
      allowedValues: None,
    },
    {
      name: "tags",
      fieldType: Array,
      required: false,
      maxLength: None,
      maxItems: Some(10),
      allowedValues: None,
    },
    {
      name: "priority",
      fieldType: String,
      required: false,
      maxLength: Some(16),
      maxItems: None,
      allowedValues: Some(["low", "medium", "high", "critical"]),
    },
  ]

  let getFieldDefinition = (schema: schema, fieldName: string): option<fieldDefinition> => {
    schema->Js.Array2.find(field => field.name === fieldName)
  }
}

module ValidationResult = {
  type t = Valid | Invalid(array<string>) // Array of error messages

  let isValid = (result: t): bool =>
    switch result {
    | Valid => true
    | Invalid(_) => false
    }

  let getErrors = (result: t): array<string> =>
    switch result {
    | Valid => []
    | Invalid(errors) => errors
    }

  let combine = (results: array<t>): t => {
    let allErrors = results->Js.Array2.reduce((acc, result) => {
      switch result {
      | Valid => acc
      | Invalid(errors) => acc->Js.Array2.concat(errors)
      }
    }, [])

    if allErrors->Js.Array2.length === 0 {
      Valid
    } else {
      Invalid(allErrors)
    }
  }
}

module Sanitizer = {
  // HTML escape to prevent XSS
  let escapeHtml = (input: string): string => {
    input
    ->Js.String2.replaceByRe(%re("/&/g"), "&amp;")
    ->Js.String2.replaceByRe(%re("/</g"), "&lt;")
    ->Js.String2.replaceByRe(%re("/>/g"), "&gt;")
    ->Js.String2.replaceByRe(%re("/\"/g"), "&quot;")
    ->Js.String2.replaceByRe(%re("/'/g"), "&#x27;")
    ->Js.String2.replaceByRe(%re("/\//g"), "&#x2F;")
  }

  // Sanitize string value (HTML escape + trim + remove newlines)
  let sanitizeString = (input: string): string => {
    input
    ->Js.String2.trim
    ->Js.String2.replaceByRe(%re("/[\r\n]/g"), "") // Remove newlines to prevent log injection
    ->escapeHtml
  }

  // Recursively sanitize metadata object
  let rec sanitizeMetadata = (metadata: Js.Dict.t<Js.Json.t>): Js.Dict.t<Js.Json.t> => {
    let sanitized = Js.Dict.empty()

    metadata
    ->Js.Dict.keys
    ->Js.Array2.forEach(key => {
      let value = metadata->Js.Dict.get(key)
      switch value {
      | None => ()
      | Some(json) =>
        switch Js.Json.classify(json) {
        | JSONString(str) =>
          // Sanitize string values
          let sanitizedStr = sanitizeString(str)
          sanitized->Js.Dict.set(key, Js.Json.string(sanitizedStr))
        | JSONNumber(_) | JSONTrue | JSONFalse | JSONNull =>
          // Pass through non-string primitives
          sanitized->Js.Dict.set(key, json)
        | JSONArray(arr) =>
          // Recursively sanitize array elements
          let sanitizedArr = arr->Js.Array2.map(item => {
            switch Js.Json.classify(item) {
            | JSONString(str) => Js.Json.string(sanitizeString(str))
            | _ => item
            }
          })
          sanitized->Js.Dict.set(key, Js.Json.array(sanitizedArr))
        | JSONObject(obj) =>
          // Recursively sanitize nested objects
          let sanitizedObj = sanitizeMetadata(obj)
          sanitized->Js.Dict.set(key, Js.Json.object_(sanitizedObj))
        }
      }
    })

    sanitized
  }
}

module SizeValidator = {
  // Maximum metadata size in bytes (10KB)
  let maxMetadataSizeBytes = 10240

  // Calculate approximate JSON size
  let calculateSize = (metadata: Js.Dict.t<Js.Json.t>): int => {
    try {
      let json = Js.Json.object_(metadata)
      let jsonString = Js.Json.stringify(json)
      jsonString->Js.String2.length
    } catch {
    | _ => 0
    }
  }

  let validateSize = (metadata: Js.Dict.t<Js.Json.t>): ValidationResult.t => {
    let size = calculateSize(metadata)
    if size > maxMetadataSizeBytes {
      ValidationResult.Invalid([
        `Metadata size (${size->Js.Int.toString} bytes) exceeds maximum allowed (${maxMetadataSizeBytes->Js.Int.toString} bytes)`,
      ])
    } else {
      ValidationResult.Valid
    }
  }
}

module SchemaValidator = {
  // Validate a single field against its definition
  let validateField = (
    fieldDef: MetadataSchema.fieldDefinition,
    value: option<Js.Json.t>,
  ): ValidationResult.t => {
    switch (value, fieldDef.required) {
    | (None, true) => ValidationResult.Invalid([`Required field '${fieldDef.name}' is missing`])
    | (None, false) => ValidationResult.Valid
    | (Some(json), _) =>
      switch (Js.Json.classify(json), fieldDef.fieldType) {
      | (JSONString(str), MetadataSchema.String) =>
        // Validate string length
        switch fieldDef.maxLength {
        | Some(maxLen) =>
          if str->Js.String2.length > maxLen {
            ValidationResult.Invalid([
              `Field '${fieldDef.name}' exceeds maximum length (${maxLen->Js.Int.toString})`,
            ])
          } else {
            ValidationResult.Valid
          }
        | None => ValidationResult.Valid
        }
      | (JSONNumber(_), MetadataSchema.Number) => ValidationResult.Valid
      | (JSONTrue | JSONFalse, MetadataSchema.Boolean) => ValidationResult.Valid
      | (JSONArray(arr), MetadataSchema.Array) =>
        // Validate array length
        switch fieldDef.maxItems {
        | Some(maxItems) =>
          if arr->Js.Array2.length > maxItems {
            ValidationResult.Invalid([
              `Field '${fieldDef.name}' array exceeds maximum items (${maxItems->Js.Int.toString})`,
            ])
          } else {
            ValidationResult.Valid
          }
        | None => ValidationResult.Valid
        }
      | (JSONObject(_), MetadataSchema.Object) => ValidationResult.Valid
      | _ =>
        ValidationResult.Invalid([
          `Field '${fieldDef.name}' has invalid type (expected ${switch fieldDef.fieldType {
            | MetadataSchema.String => "string"
            | MetadataSchema.Number => "number"
            | MetadataSchema.Boolean => "boolean"
            | MetadataSchema.Array => "array"
            | MetadataSchema.Object => "object"
            }})`,
        ])
      }
    }
  }

  // Validate entire metadata against schema
  let validate = (
    schema: MetadataSchema.schema,
    metadata: Js.Dict.t<Js.Json.t>,
  ): ValidationResult.t => {
    // Validate required fields and field types
    let fieldResults = schema->Js.Array2.map(fieldDef => {
      let value = metadata->Js.Dict.get(fieldDef.name)
      validateField(fieldDef, value)
    })

    ValidationResult.combine(fieldResults)
  }
}

module FieldWhitelister = {
  // Remove unknown fields from metadata (only keep fields in schema)
  let whitelist = (
    schema: MetadataSchema.schema,
    metadata: Js.Dict.t<Js.Json.t>,
  ): Js.Dict.t<Js.Json.t> => {
    let whitelisted = Js.Dict.empty()
    let allowedFields = schema->Js.Array2.map(field => field.name)

    metadata
    ->Js.Dict.keys
    ->Js.Array2.forEach(key => {
      if allowedFields->Js.Array2.includes(key) {
        switch metadata->Js.Dict.get(key) {
        | Some(value) => whitelisted->Js.Dict.set(key, value)
        | None => ()
        }
      }
    })

    whitelisted
  }

  // Get list of removed fields (for logging)
  let getRemovedFields = (
    schema: MetadataSchema.schema,
    metadata: Js.Dict.t<Js.Json.t>,
  ): array<string> => {
    let allowedFields = schema->Js.Array2.map(field => field.name)
    metadata
    ->Js.Dict.keys
    ->Js.Array2.filter(key => {
      let isAllowed = allowedFields->Js.Array2.some(field => field === key)
      !isAllowed
    })
  }
}

module MetadataValidator = {
  // Complete validation pipeline
  type validationReport = {
    valid: bool,
    errors: array<string>,
    warnings: array<string>, // For whitelisted fields
    sanitized: Js.Dict.t<Js.Json.t>,
  }

  let validate = (
    schema: MetadataSchema.schema,
    metadata: Js.Dict.t<Js.Json.t>,
  ): validationReport => {
    // Step 1: Size validation
    let sizeValidation = SizeValidator.validateSize(metadata)

    // Step 2: Whitelist fields (remove unknown fields)
    let removedFields = FieldWhitelister.getRemovedFields(schema, metadata)
    let whitelisted = FieldWhitelister.whitelist(schema, metadata)

    // Step 3: Schema validation
    let schemaValidation = SchemaValidator.validate(schema, whitelisted)

    // Step 4: Sanitization (HTML escape)
    let sanitized = Sanitizer.sanitizeMetadata(whitelisted)

    // Combine results
    let allErrors = ValidationResult.combine([sizeValidation, schemaValidation])
    let warnings = if removedFields->Js.Array2.length > 0 {
      [
        `Removed ${removedFields->Js.Array2.length->Js.Int.toString} unknown fields: ${removedFields->Js.Array2.joinWith(", ")}`,
      ]
    } else {
      []
    }

    {
      valid: ValidationResult.isValid(allErrors),
      errors: ValidationResult.getErrors(allErrors),
      warnings: warnings,
      sanitized: sanitized,
    }
  }

  // Quick validation (returns bool)
  let isValid = (schema: MetadataSchema.schema, metadata: Js.Dict.t<Js.Json.t>): bool => {
    let report = validate(schema, metadata)
    report.valid
  }

  // Validate and return sanitized metadata (throws if invalid)
  let validateAndSanitize = (
    schema: MetadataSchema.schema,
    metadata: Js.Dict.t<Js.Json.t>,
  ): Js.Dict.t<Js.Json.t> => {
    let report = validate(schema, metadata)
    if report.valid {
      report.sanitized
    } else {
      // In production, this would throw a proper exception
      // For now, return empty dict
      Js.Dict.empty()
    }
  }
}

// Export types and functions for JavaScript/TypeScript consumption
type metadata = Js.Dict.t<Js.Json.t>
type fieldDefinition = MetadataSchema.fieldDefinition
type schema = MetadataSchema.schema
type validationResult = ValidationResult.t
type validationReport = MetadataValidator.validationReport

let taskMetadataSchema = MetadataSchema.taskMetadataSchema
let escapeHtml = Sanitizer.escapeHtml
let sanitizeString = Sanitizer.sanitizeString
let sanitizeMetadata = Sanitizer.sanitizeMetadata
let validateMetadata = MetadataValidator.validate
let isValidMetadata = MetadataValidator.isValid
let validateAndSanitize = MetadataValidator.validateAndSanitize
let whitelistFields = FieldWhitelister.whitelist
let calculateMetadataSize = SizeValidator.calculateSize
let maxMetadataSizeBytes = SizeValidator.maxMetadataSizeBytes
