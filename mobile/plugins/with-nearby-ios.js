const { withInfoPlist, withXcodeProject } = require("expo/config-plugins");
const crypto = require("node:crypto");

module.exports = function withNearbyIos(config) {
  config = withInfoPlist(config, (result) => {
    const serviceId = result.modResults.MaisTrilhaNearbyServiceId ||
      "com.maistrilhasmenosestresse.mesh.v1";
    const hash = crypto.createHash("sha256").update(serviceId).digest("hex").slice(0, 24);
    const bonjour = `_${hash}._tcp`;
    result.modResults.NSBonjourServices = Array.from(new Set([
      ...(result.modResults.NSBonjourServices || []),
      bonjour,
    ]));
    return result;
  });
  return withXcodeProject(config, (result) => {
    addNearbySwiftPackage(result.modResults);
    return result;
  });
};

function addNearbySwiftPackage(project) {
  const repositoryURL = "https://github.com/google/nearby.git";
  const revision = "bc15d624ac07db7bbdc654cdc03ea1cac5fca0c9";
  const productName = "NearbyConnections";
  const objects = project.hash.project.objects;
  const packageSection = objects.XCRemoteSwiftPackageReference ||= {};
  const existingId = Object.keys(packageSection).find((key) =>
    !key.endsWith("_comment") && String(packageSection[key]?.repositoryURL || "").includes("google/nearby")
  );
  if (existingId) return;

  const packageId = project.generateUuid();
  const productId = project.generateUuid();
  const buildFileId = project.generateUuid();
  packageSection[packageId] = {
    isa: "XCRemoteSwiftPackageReference",
    repositoryURL: `"${repositoryURL}"`,
    requirement: {
      kind: "revision",
      revision: `"${revision}"`,
    },
  };
  packageSection[`${packageId}_comment`] = 'XCRemoteSwiftPackageReference "nearby"';

  const productSection = objects.XCSwiftPackageProductDependency ||= {};
  productSection[productId] = {
    isa: "XCSwiftPackageProductDependency",
    package: packageId,
    package_comment: 'XCRemoteSwiftPackageReference "nearby"',
    productName,
  };
  productSection[`${productId}_comment`] = productName;

  const buildSection = objects.PBXBuildFile ||= {};
  buildSection[buildFileId] = {
    isa: "PBXBuildFile",
    productRef: productId,
    productRef_comment: productName,
  };
  buildSection[`${buildFileId}_comment`] = `${productName} in Frameworks`;

  const firstProject = project.getFirstProject().firstProject;
  firstProject.packageReferences ||= [];
  firstProject.packageReferences.push({
    value: packageId,
    comment: 'XCRemoteSwiftPackageReference "nearby"',
  });

  const target = project.getFirstTarget();
  target.firstTarget.packageProductDependencies ||= [];
  target.firstTarget.packageProductDependencies.push({
    value: productId,
    comment: productName,
  });
  const frameworks = project.pbxFrameworksBuildPhaseObj(target.uuid);
  frameworks.files ||= [];
  frameworks.files.push({
    value: buildFileId,
    comment: `${productName} in Frameworks`,
  });
}
