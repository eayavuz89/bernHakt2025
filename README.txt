# Finance GraphDB Assistant 💰🤖

Dieses Projekt hat zum Ziel, **finanzielle Daten mit GraphDB zu analysieren** und einen **KI-gestützten persönlichen Finanzassistenten** zu entwickeln.
Nutzer können ihre Ausgaben abfragen, Analysen nach Kategorien durchführen und in natürlicher Sprache finanzielle Fragen stellen.

## Architekturdiagramm  

![Systemarchitektur](./Codecapitän Workflow.jpg)

## 🚀 Demo

Die Live-Anwendung kann hier getestet werden:
👉 [Finance Assistant Live Demo](https://bernhackt.letbotchat.com/)

Video-Demo:
🎥 Die Datei `video.mp4` zeigt die Funktionen der Anwendung.

---

## 📂 Repository-Struktur

```
├── graph/               # GraphDB-Daten (Pest Finance Daten)
├── webUI/               # Benutzeroberfläche (UI-Code)
├── video.mp4            # Video-Demo der Anwendung
└── README.md            # Projektbeschreibung
```

---

## 🧩 Technologien

* **GraphDB** → Speicherung der Finanztransaktionen und Produktdaten im RDF/OWL-Format
* **SPARQL** → Abfragen und Analysen auf den Daten
* **Web UI (React/Next.js oder ähnlich)** → Benutzerfreundliche Finanzoberfläche
* **KI-Assistent (LLM-basiert)** → Beantwortung von Finanzfragen in natürlicher Sprache

---

## 📊 Beispiel-SPARQL-Abfragen

### 1. Alle Produkte, die im Juli gekauft wurden

```sparql
SELECT ?date ?merchant ?productName ?subtotal
WHERE {
  ?transaction a exs:FinancialTransaction ;
               exs:hasTransactionDate ?date ;
               exs:hasParticipant ?participant_role_payee ;
               exs:hasReceipt ?receipt .

  ?participant_role_payee a exs:Payee ;
                          exs:isPlayedBy ?merchant .

  ?receipt exs:hasLineItem ?lineItem .

  ?lineItem a exs:ReceiptLineItem ;
            exs:lineSubtotal ?subtotal ;
            exs:hasProduct ?product .

  ?product a exs:Product ;
           rdfs:label ?productName .

  FILTER (?date >= "2024-07-01"^^xsd:date && ?date <= "2024-07-31"^^xsd:date)
}
ORDER BY ?date
```

### 2. Alle Transaktionen vom letzten Monat

```sparql
SELECT ?transaction ?date ?merchant ?receipt ?lineItem ?product ?subtotal
WHERE {
  ?transaction a exs:FinancialTransaction ;
               exs:hasTransactionDate ?date ;
               exs:hasReceipt ?receipt ;
               exs:hasParticipant ?participant_role_payee .

  ?participant_role_payee a exs:Payee ;
                          exs:isPlayedBy ?merchant .

  ?receipt exs:hasLineItem ?lineItem .

  ?lineItem a exs:ReceiptLineItem ;
            exs:hasProduct ?product ;
            exs:lineSubtotal ?subtotal .

  ?product a exs:Product ;
           rdfs:label ?productName .

  FILTER (?date >= "2024-08-01"^^xsd:date && ?date <= "2024-08-31"^^xsd:date)
}
ORDER BY ?date
```

---

## 👥 Team

Dieses Projekt wurde mit den **Pest Finance**-Daten im Rahmen eines Hackathons entwickelt.
Mitwirkende: `Enes Yılmaztürk` und Teammitglieder.

---

## 📌 Zukünftige Erweiterungen

* Erweiterte Unterstützung für natürliche Sprachabfragen
* Visualisierte Ausgabenanalysen
* Intelligente Budgetempfehlungen nach Kategorien
* Mobile-optimierte Benutzeroberfläche


live link 
https://bernhackt.letbotchat.com/