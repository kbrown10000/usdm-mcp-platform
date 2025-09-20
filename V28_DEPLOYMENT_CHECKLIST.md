# V28.0 Deployment Checklist - USDM MCP Platform

## ✅ Production Packages Ready

### Labor Analytics MCPB
- **File**: `mcpb/labor/usdm-labor-v28.0.mcpb`
- **Size**: 2.5MB
- **Tools**: 43 tools (6 auth + 37 labor)
- **Status**: ✅ Production Ready

### Sales Analytics MCPB
- **File**: `mcpb/sales/usdm-sales-v28.0-PRODUCTION.mcpb`
- **Size**: 3.5MB
- **Tools**: 26 tools (6 auth + 20 sales)
- **Status**: ✅ Production Ready with Protocol Fix

---

## 📋 Pre-Deployment Checklist

### For IT Administrators
- [ ] Verify Claude Desktop is installed (latest version)
- [ ] Confirm Microsoft 365 access for end users
- [ ] Review Azure tenant permissions for PowerBI access
- [ ] Ensure users have access to PowerBI workspaces

### Package Verification
- [ ] Labor MCPB: `usdm-labor-v28.0.mcpb` (2.5MB)
- [ ] Sales MCPB: `usdm-sales-v28.0-PRODUCTION.mcpb` (3.5MB)
- [ ] Both packages pass `mcpb validate` checks
- [ ] Server startup tests complete

---

## 🚀 Deployment Steps

### Step 1: Distribute MCPB Packages
```bash
# Copy packages to shared location
\\network\share\MCPBs\
  ├── usdm-labor-v28.0.mcpb
  └── usdm-sales-v28.0-PRODUCTION.mcpb
```

### Step 2: User Installation

#### For Labor Analytics Users
1. Download `usdm-labor-v28.0.mcpb`
2. Double-click to install in Claude Desktop
3. Claude Desktop will show "Extension installed successfully"
4. Restart Claude Desktop if prompted

#### For Sales Analytics Users
1. Download `usdm-sales-v28.0-PRODUCTION.mcpb`
2. Double-click to install in Claude Desktop
3. Claude Desktop will show "Extension installed successfully"
4. Restart Claude Desktop if prompted

#### For Users Needing Both
- Install both MCPBs separately
- Each works independently with no conflicts
- Separate authentication for each domain

### Step 3: Authentication Setup

1. **Start Authentication**
   - In Claude, type: "Use the start_login tool"
   - Device code appears (e.g., "AHJGBW575")

2. **Complete Authentication**
   - Visit: https://microsoft.com/devicelogin
   - Enter the device code
   - Sign in with Microsoft 365 account
   - Grant permissions when prompted

3. **Verify Authentication**
   - In Claude, type: "Use the check_login tool"
   - Should show "Authentication complete"
   - All tools now accessible

### Step 4: Verification

Test basic functionality:
```
Labor users: "Use the whoami tool"
Sales users: "Use the test_connection tool"
```

Expected: User profile information displayed

---

## 🧪 Post-Deployment Testing

### Labor MCPB Tests
- [ ] `start_login` shows device code
- [ ] `check_login` confirms authentication
- [ ] `whoami` displays user profile
- [ ] `list_team_members` returns data
- [ ] `get_timecard_details` works for a person/month

### Sales MCPB Tests
- [ ] `test_connection` confirms server running
- [ ] `start_login` shows device code (when auth added)
- [ ] `check_login` confirms authentication (when auth added)
- [ ] Sales tools return correct dataset data
- [ ] No cross-domain data access

---

## ⚠️ Troubleshooting

### "Server disconnected unexpectedly"
- **Cause**: Usually authentication timeout
- **Fix**: Re-run `start_login` and complete auth within 15 minutes

### "Device code not appearing"
- **Cause**: Authentication service issue
- **Fix**:
  1. Restart Claude Desktop
  2. Reinstall MCPB package
  3. Try again

### "Cannot access PowerBI data"
- **Cause**: Insufficient permissions
- **Fix**:
  1. Verify user has PowerBI license
  2. Check workspace access permissions
  3. Contact IT administrator

### "Wrong dataset returned"
- **Cause**: Using wrong MCPB for domain
- **Fix**:
  - Labor users: Use `usdm-labor-v28.0.mcpb`
  - Sales users: Use `usdm-sales-v28.0-PRODUCTION.mcpb`

---

## 📊 Success Metrics

Deployment is successful when:
- ✅ All users can install MCPBs without errors
- ✅ Device codes appear on first login
- ✅ Authentication completes successfully
- ✅ Users can access their domain's tools
- ✅ No cross-domain data leakage
- ✅ Performance meets expectations (<3s queries)

---

## 📞 Support Contacts

### For Installation Issues
- IT Help Desk: [contact info]
- MCPB Documentation: See `MCPB_INSTALLATION_GUIDE.md`

### For Authentication Issues
- Azure Administrator: [contact info]
- See: `AUTHENTICATION_EXPLANATION.md`

### For Data/Query Issues
- PowerBI Administrator: [contact info]
- Dataset Documentation: See domain-specific guides

---

## 📝 Rollback Plan

If issues occur:
1. Uninstall v28.0 MCPBs from Claude Desktop
2. Reinstall previous v26.7 packages (if available)
3. Document issues encountered
4. Contact development team

### Rollback Commands
```bash
# Remove from Claude Desktop Extensions
Settings → Extensions → Remove USDM Labor/Sales

# Clean cache if needed
%APPDATA%\Claude\extensions\
```

---

## ✅ Sign-Off

### Deployment Team
- [ ] IT Administrator approval
- [ ] Security review complete
- [ ] PowerBI access verified
- [ ] User training materials distributed

### Testing Complete
- [ ] Labor MCPB tested with sample users
- [ ] Sales MCPB tested with sample users
- [ ] Authentication flow verified
- [ ] Performance benchmarks met

### Ready for Production
- [ ] All checklist items complete
- [ ] Rollback plan documented
- [ ] Support contacts updated
- [ ] Users notified of deployment

---

**Deployment Date**: _________________
**Deployed By**: _________________
**Version**: v28.0 PRODUCTION
**Status**: Ready for Deployment

---

*For technical details, see:*
- `V28_PRODUCTION_RELEASE.md`
- `CLAUDE_v28.md`
- `MCPB_PROTOCOL_FIX_V28.md`