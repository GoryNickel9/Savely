package cc.savely.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import java.nio.file.Path;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** Regression for the Browser Helper launch crash when its settings component is omitted.
 * Browser Helper calls setComponentEnabledSetting() before it checks shortcut availability.
 * Android's PackageManager requires this activity to be registered in the APK manifest.
 */
public final class BrowserHelperManifestTest {
    private static final String ANDROID = "http://schemas.android.com/apk/res/android";
    private static final String SETTINGS_ACTIVITY =
            "com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity";

    @Test
    public void registersTheSettingsComponentRequiredByBrowserHelperAtLaunch() throws Exception {
        Document manifest = readManifest();

        Element application = (Element) manifest.getElementsByTagName("application").item(0);
        assertEquals(SETTINGS_ACTIVITY, application.getAttributeNS(ANDROID, "manageSpaceActivity"));

        Element activity = findByAndroidName(manifest.getElementsByTagName("activity"), SETTINGS_ACTIVITY);
        assertNotNull("Browser Helper enables this activity before launching the browser", activity);
        assertEquals("false", activity.getAttributeNS(ANDROID, "exported"));
        assertEquals("true", activity.getAttributeNS(ANDROID, "enabled"));

        Element manageUrl = findByAndroidName(activity.getElementsByTagName("meta-data"),
                "android.support.customtabs.trusted.MANAGE_SPACE_URL");
        assertNotNull(manageUrl);
        assertEquals(LaunchUrlPolicy.HOME_URL, manageUrl.getAttributeNS(ANDROID, "value"));
    }

    @Test
    public void verifiesOnlyTheCanonicalHostAndUsesItAsDefault() throws Exception {
        Document manifest = readManifest();
        Element twa = findByAndroidName(manifest.getElementsByTagName("activity"), ".SavelyTwaActivity");
        assertNotNull(twa);
        Element defaultUrl = findByAndroidName(twa.getElementsByTagName("meta-data"),
                "android.support.customtabs.trusted.DEFAULT_URL");
        assertNotNull(defaultUrl);
        assertEquals(LaunchUrlPolicy.HOME_URL, defaultUrl.getAttributeNS(ANDROID, "value"));

        NodeList hosts = manifest.getElementsByTagName("data");
        assertEquals("Only the canonical domain may participate in App Link verification", 1, hosts.getLength());
        assertEquals("www.savely.cc", ((Element) hosts.item(0)).getAttributeNS(ANDROID, "host"));
    }

    private static Document readManifest() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        // Android's XMLConstants API lacks these constants; JVM tests use the JAXP URI names.
        factory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalDTD", "");
        factory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalSchema", "");
        return factory.newDocumentBuilder().parse(Path.of("src/main/AndroidManifest.xml").toFile());
    }

    private static Element findByAndroidName(NodeList elements, String name) {
        for (int index = 0; index < elements.getLength(); index++) {
            Element element = (Element) elements.item(index);
            if (name.equals(element.getAttributeNS(ANDROID, "name"))) {
                return element;
            }
        }
        return null;
    }
}
