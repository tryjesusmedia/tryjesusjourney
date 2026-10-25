// Refresh only the Journey provisioning profile; reuse the stored distribution certificate.
// Uses the inspected eas-cli 25.3.0 credential actions before the frozen build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cliRoot = process.env.JOURNEY_EAS_CLI_ROOT;
assert(cliRoot, 'Missing EAS CLI package path');
const cli = name => require(path.join(cliRoot, 'build', name));
assert.equal(require(path.join(cliRoot, 'package.json')).version, '25.3.0');
const EasCommand = cli('commandUtils/EasCommand').default;
const { CredentialsContext } = cli('credentials/context');
const { AccountQuery } = cli('graphql/queries/AccountQuery');
const { SetUpDistributionCertificate } = cli('credentials/ios/actions/SetUpDistributionCertificate');
const { SetUpProvisioningProfile } = cli('credentials/ios/actions/SetUpProvisioningProfile');

class RefreshJourneyProfile extends EasCommand {
  static description = 'Refresh the existing Journey App Store provisioning profile';
  static contextDefinition = {
    ...this.ContextOptions.LoggedIn,
    ...this.ContextOptions.Analytics,
    ...this.ContextOptions.Vcs,
  };
  async runAsync() {
    await this.parse(RefreshJourneyProfile);
    const { loggedIn: { actor, graphqlClient }, analytics, vcsClient } =
      await this.getContextAsync(RefreshJourneyProfile, {
        nonInteractive: true, withServerSideEnvironment: null,
      });
    const exp = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
    assert.equal(exp.owner, 'try-jesus-media');
    assert.equal(exp.ios.bundleIdentifier, 'com.tryjesusmedia.journey');
    const account = await AccountQuery.getByNameAsync(graphqlClient, exp.owner);
    assert(account, 'Existing Expo owner account not found');
    const app = { account, projectName: exp.slug, bundleIdentifier: exp.ios.bundleIdentifier };
    const target = {
      targetName: exp.name.replace(/[^a-zA-Z0-9]/g, ''),
      bundleIdentifier: app.bundleIdentifier,
      entitlements: { 'com.apple.developer.applesignin': ['Default'] },
    };
    const ctx = new CredentialsContext({
      projectInfo: { exp, projectId: exp.extra.eas.projectId },
      easJsonCliConfig: JSON.parse(fs.readFileSync('eas.json', 'utf8')).cli,
      nonInteractive: true, projectDir: process.cwd(), user: actor,
      graphqlClient, analytics, vcsClient, freezeCredentials: false,
    });
    // In non-interactive mode this action requires an existing certificate and cannot create one.
    const before = await new SetUpDistributionCertificate(app, 'APP_STORE').runAsync(ctx);
    assert(new Date(before.validityNotAfter) > new Date(), 'Existing distribution certificate expired');
    const credentials = await new SetUpProvisioningProfile(app, target, 'APP_STORE').runAsync(ctx);
    const after = await new SetUpDistributionCertificate(app, 'APP_STORE').runAsync(ctx);
    assert.equal(after.id, before.id, 'Distribution signing identity changed');
    assert.equal(after.serialNumber, before.serialNumber, 'Distribution certificate changed');
    assert(credentials, 'Provisioning profile could not be prepared');
    console.log('Journey App Store profile is ready; existing distribution certificate preserved.');
  }
}
RefreshJourneyProfile.run([], { root: cliRoot }).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
