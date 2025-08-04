# STORY: Implement FoundryPuppeteer validation interface

## Description
Building on our reliable server activation system, implement a Puppeteer-based validation interface that uses FoundryVTT's actual validation system. This ensures all document validation uses the real FoundryVTT code and data models, with no mocking or fallbacks.

### Acceptance Criteria
- [x] Create FoundryPuppeteerValidator class with proper error handling
- [x] Use activated game session for validation (requires proper server state)
- [x] Access real window.CONFIG and game object for validation
- [x] Support all core document types (Item, Actor, etc.)
- [x] Implement schema extraction for validation rules
- [x] Add comprehensive test coverage for all scenarios
- [x] Support system-specific validation rules

### Tasks
1. Implement core validator class:
   ```typescript
   class FoundryPuppeteerValidator {
     private serverManager: FoundryServerManager;
     private validationTimeout: number;
     private initialized: boolean;

     constructor(options: {
       serverManager: FoundryServerManager;
       timeout?: number;
     });

     async initialize(): Promise<void>;
     async validateDocument(type: string, data: any): Promise<ValidationResult>;
     async getSchema(documentType: string): Promise<SchemaInfo>;
     async getAvailableTypes(): Promise<DocumentTypes>;
   }
   ```

2. Implement validation flow:
   - Verify proper server/game state
   - Access document classes from CONFIG
   - Use validateCreate() or validateUpdate()
   - Handle validation errors
   - Support system-specific rules

3. Add schema extraction:
   - Access document class schemas
   - Extract field definitions
   - Support nested schemas
   - Map to JSON format

4. Create test suite:
   - Unit tests for each method
   - Integration tests for full flow
   - Error case testing
   - Schema validation

5. Update documentation:
   - API reference
   - Usage examples
   - Migration guide
   - Error handling

### Technical Dependencies
1. FoundryServerManager with proper state
2. Access to game.items, game.actors etc.
3. System-specific validation rules
4. Document class schemas

### Implementation Details

#### 1. Validation Flow
```javascript
async validateDocument(type, data) {
  await this._ensureInitialized();
  
  // Get document class
  const DocumentClass = await this._getDocumentClass(type);
  
  // Validate using FoundryVTT
  const document = new DocumentClass(data, { 
    validateOnly: true,
    strict: true 
  });
  
  return {
    success: true,
    data: document.toObject(),
    schema: await this.getSchema(type)
  };
}
```

#### 2. Schema Extraction
```javascript
async getSchema(documentType) {
  const DocumentClass = await this._getDocumentClass(documentType);
  const schema = DocumentClass.schema;
  
  return {
    fields: this._extractFields(schema),
    systemFields: this._extractSystemFields(schema)
  };
}
```

#### 3. Error Handling
```javascript
class ValidationError extends Error {
  constructor(message, field, code) {
    super(message);
    this.field = field;
    this.code = code;
  }
}
```

### Test Coverage
1. Basic Validation
   - Simple document creation
   - Required fields
   - Field type validation

2. Complex Cases
   - Nested objects
   - Array fields
   - Embedded documents
   - System-specific rules

3. Error Cases
   - Missing fields
   - Invalid types
   - System validation errors
   - Connection issues

### Migration Steps
1. Update validation calls
2. Handle asynchronous flow
3. Update error handling
4. Remove old validation code
